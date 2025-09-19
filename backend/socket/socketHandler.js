const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');

// Store active connections
const activeConnections = new Map();
const eventRooms = new Map(); // eventId -> Set of socketIds
const userSockets = new Map(); // userId -> Set of socketIds

/**
 * Socket.io event handler
 */
module.exports = (io) => {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user || user.status !== 'active') {
        return next(new Error('Invalid or inactive user'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Handle new connections
  io.on('connection', (socket) => {
    console.log(\`User \${socket.user.fullName} connected: \${socket.id}\`);
    
    // Store connection
    activeConnections.set(socket.id, {
      userId: socket.userId,
      user: socket.user,
      connectedAt: new Date()
    });

    // Add to user sockets map
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    // Join user to their personal room
    socket.join(\`user_\${socket.userId}\`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Dynamic Event Hub',
      user: {
        id: socket.user._id,
        name: socket.user.fullName,
        avatar: socket.user.avatar
      },
      timestamp: new Date()
    });

    // Broadcast user online status to friends/followers
    broadcastUserStatus(socket, 'online');

    // Event-related socket handlers
    setupEventHandlers(socket, io);
    
    // Chat handlers
    setupChatHandlers(socket, io);
    
    // Notification handlers
    setupNotificationHandlers(socket, io);
    
    // Real-time updates handlers
    setupRealTimeHandlers(socket, io);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(\`User \${socket.user.fullName} disconnected: \${socket.id} - Reason: \${reason}\`);
      
      // Remove from active connections
      activeConnections.delete(socket.id);
      
      // Remove from user sockets
      const userSocketSet = userSockets.get(socket.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(socket.userId);
          // User is completely offline
          broadcastUserStatus(socket, 'offline');
        }
      }

      // Leave all event rooms
      eventRooms.forEach((socketSet, eventId) => {
        if (socketSet.has(socket.id)) {
          socketSet.delete(socket.id);
          socket.to(\`event_\${eventId}\`).emit('user_left_event', {
            userId: socket.userId,
            userName: socket.user.fullName,
            timestamp: new Date()
          });
        }
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(\`Socket error for user \${socket.userId}:\`, error);
    });
  });

  /**
   * Setup event-related socket handlers
   */
  function setupEventHandlers(socket, io) {
    // Join event room for real-time updates
    socket.on('join_event', async (data) => {
      try {
        const { eventId } = data;
        const event = await Event.findById(eventId);
        
        if (!event) {
          socket.emit('error', { message: 'Event not found' });
          return;
        }

        // Check if user has access to the event
        const hasAccess = event.visibility === 'public' || 
                         event.organizer.toString() === socket.userId ||
                         event.attendees.some(attendee => attendee.user.toString() === socket.userId);

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this event' });
          return;
        }

        // Join event room
        socket.join(\`event_\${eventId}\`);
        
        // Track event room membership
        if (!eventRooms.has(eventId)) {
          eventRooms.set(eventId, new Set());
        }
        eventRooms.get(eventId).add(socket.id);

        // Notify others in the event room
        socket.to(\`event_\${eventId}\`).emit('user_joined_event', {
          userId: socket.userId,
          userName: socket.user.fullName,
          userAvatar: socket.user.avatar,
          timestamp: new Date()
        });

        socket.emit('joined_event', {
          eventId,
          message: 'Successfully joined event room'
        });

      } catch (error) {
        console.error('Join event error:', error);
        socket.emit('error', { message: 'Failed to join event' });
      }
    });

    // Leave event room
    socket.on('leave_event', (data) => {
      const { eventId } = data;
      socket.leave(\`event_\${eventId}\`);
      
      // Remove from event room tracking
      const eventSocketSet = eventRooms.get(eventId);
      if (eventSocketSet) {
        eventSocketSet.delete(socket.id);
        if (eventSocketSet.size === 0) {
          eventRooms.delete(eventId);
        }
      }

      // Notify others
      socket.to(\`event_\${eventId}\`).emit('user_left_event', {
        userId: socket.userId,
        userName: socket.user.fullName,
        timestamp: new Date()
      });
    });

    // Real-time event updates
    socket.on('event_update', async (data) => {
      try {
        const { eventId, updateType, updateData } = data;
        const event = await Event.findById(eventId);
        
        if (!event || event.organizer.toString() !== socket.userId) {
          socket.emit('error', { message: 'Unauthorized to update this event' });
          return;
        }

        // Broadcast update to all users in event room
        io.to(\`event_\${eventId}\`).emit('event_updated', {
          eventId,
          updateType,
          updateData,
          updatedBy: {
            id: socket.userId,
            name: socket.user.fullName
          },
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Event update error:', error);
        socket.emit('error', { message: 'Failed to update event' });
      }
    });
  }

  /**
   * Setup chat handlers
   */
  function setupChatHandlers(socket, io) {
    // Send message to event chat
    socket.on('send_event_message', async (data) => {
      try {
        const { eventId, message, messageType = 'text' } = data;
        
        // Validate event access
        const event = await Event.findById(eventId);
        if (!event || !event.features.hasChat) {
          socket.emit('error', { message: 'Chat not available for this event' });
          return;
        }

        const chatMessage = {
          id: Date.now().toString(),
          eventId,
          userId: socket.userId,
          userName: socket.user.fullName,
          userAvatar: socket.user.avatar,
          message,
          messageType,
          timestamp: new Date()
        };

        // Broadcast to event room
        io.to(\`event_\${eventId}\`).emit('new_event_message', chatMessage);

        // Store message in database (optional - implement ChatMessage model)
        // await ChatMessage.create(chatMessage);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
      const { eventId } = data;
      socket.to(\`event_\${eventId}\`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        eventId
      });
    });

    socket.on('typing_stop', (data) => {
      const { eventId } = data;
      socket.to(\`event_\${eventId}\`).emit('user_stopped_typing', {
        userId: socket.userId,
        eventId
      });
    });
  }

  /**
   * Setup notification handlers
   */
  function setupNotificationHandlers(socket, io) {
    // Send notification to specific user
    socket.on('send_notification', (data) => {
      const { targetUserId, notification } = data;
      
      io.to(\`user_\${targetUserId}\`).emit('notification', {
        ...notification,
        from: {
          id: socket.userId,
          name: socket.user.fullName,
          avatar: socket.user.avatar
        },
        timestamp: new Date()
      });
    });

    // Mark notification as read
    socket.on('mark_notification_read', (data) => {
      const { notificationId } = data;
      // Update notification status in database
      // Implementation depends on your notification model
    });
  }

  /**
   * Setup real-time update handlers
   */
  function setupRealTimeHandlers(socket, io) {
    // Live event statistics
    socket.on('request_event_stats', async (data) => {
      try {
        const { eventId } = data;
        const event = await Event.findById(eventId);
        
        if (!event) {
          socket.emit('error', { message: 'Event not found' });
          return;
        }

        const stats = {
          eventId,
          totalAttendees: event.attendees.length,
          checkedInCount: event.attendees.filter(a => a.checkInTime).length,
          availableSpots: event.getAvailableSpots(),
          onlineViewers: eventRooms.get(eventId)?.size || 0,
          timestamp: new Date()
        };

        socket.emit('event_stats', stats);

      } catch (error) {
        console.error('Event stats error:', error);
        socket.emit('error', { message: 'Failed to get event stats' });
      }
    });

    // Live attendee check-in
    socket.on('attendee_checkin', async (data) => {
      try {
        const { eventId, attendeeId } = data;
        const event = await Event.findById(eventId);
        
        if (!event || event.organizer.toString() !== socket.userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Update attendee check-in status
        const attendee = event.attendees.id(attendeeId);
        if (attendee) {
          attendee.checkInTime = new Date();
          attendee.status = 'attended';
          await event.save();

          // Broadcast to event room
          io.to(\`event_\${eventId}\`).emit('attendee_checked_in', {
            eventId,
            attendeeId,
            checkInTime: attendee.checkInTime,
            totalCheckedIn: event.attendees.filter(a => a.checkInTime).length
          });
        }

      } catch (error) {
        console.error('Check-in error:', error);
        socket.emit('error', { message: 'Check-in failed' });
      }
    });
  }

  /**
   * Broadcast user online/offline status
   */
  function broadcastUserStatus(socket, status) {
    // This would typically involve getting user's friends/followers
    // and notifying them of status change
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      userName: socket.user.fullName,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Get active connections count
   */
  function getActiveConnectionsCount() {
    return activeConnections.size;
  }

  /**
   * Get users in event room
   */
  function getEventRoomUsers(eventId) {
    const socketIds = eventRooms.get(eventId) || new Set();
    const users = [];
    
    socketIds.forEach(socketId => {
      const connection = activeConnections.get(socketId);
      if (connection) {
        users.push({
          id: connection.userId,
          name: connection.user.fullName,
          avatar: connection.user.avatar,
          connectedAt: connection.connectedAt
        });
      }
    });
    
    return users;
  }

  // Expose utility functions
  io.getActiveConnectionsCount = getActiveConnectionsCount;
  io.getEventRoomUsers = getEventRoomUsers;
  io.activeConnections = activeConnections;
  io.eventRooms = eventRooms;
  io.userSockets = userSockets;

  console.log('Socket.io server initialized with comprehensive event handlers');
};