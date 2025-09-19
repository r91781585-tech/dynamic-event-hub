const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },
  
  // Event Details
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: [
      'conference', 'workshop', 'seminar', 'networking', 'social',
      'sports', 'music', 'art', 'food', 'technology', 'business',
      'education', 'health', 'charity', 'entertainment', 'other'
    ]
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Date and Time
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  
  // Location Information
  location: {
    type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      required: true
    },
    venue: {
      name: String,
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
      },
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      capacity: Number,
      amenities: [String]
    },
    virtual: {
      platform: String, // Zoom, Teams, etc.
      meetingLink: String,
      meetingId: String,
      password: String
    }
  },
  
  // Organizer Information
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coOrganizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Pricing and Tickets
  pricing: {
    type: {
      type: String,
      enum: ['free', 'paid', 'donation'],
      default: 'free'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    tickets: [{
      name: {
        type: String,
        required: true
      },
      description: String,
      price: {
        type: Number,
        required: true,
        min: 0
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      sold: {
        type: Number,
        default: 0
      },
      maxPerUser: {
        type: Number,
        default: 10
      },
      salesStart: Date,
      salesEnd: Date,
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // Registration Settings
  registration: {
    isRequired: {
      type: Boolean,
      default: true
    },
    deadline: Date,
    maxAttendees: Number,
    currentAttendees: {
      type: Number,
      default: 0
    },
    waitingList: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxSize: Number
    },
    approvalRequired: {
      type: Boolean,
      default: false
    },
    customFields: [{
      name: String,
      type: {
        type: String,
        enum: ['text', 'email', 'number', 'select', 'checkbox', 'textarea']
      },
      required: Boolean,
      options: [String] // for select type
    }]
  },
  
  // Media and Assets
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean
  }],
  videos: [{
    url: String,
    title: String,
    thumbnail: String
  }],
  documents: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  
  // Event Status and Visibility
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'postponed', 'completed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: Number,
    endDate: Date,
    daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
    dayOfMonth: Number
  },
  
  // Attendees and Interactions
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['registered', 'confirmed', 'attended', 'cancelled', 'no-show'],
      default: 'registered'
    },
    ticketType: String,
    customFields: [{
      name: String,
      value: String
    }],
    checkInTime: Date,
    qrCode: String
  }],
  
  waitingList: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedDate: {
      type: Date,
      default: Date.now
    },
    position: Number
  }],
  
  // Social Features
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  shares: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    platform: String,
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  
  // Analytics and Metrics
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    uniqueViews: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      viewedAt: {
        type: Date,
        default: Date.now
      },
      ipAddress: String
    }],
    clickThroughs: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    }
  },
  
  // SEO and Marketing
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    slug: {
      type: String,
      unique: true
    }
  },
  
  // Additional Features
  features: {
    hasChat: {
      type: Boolean,
      default: false
    },
    hasNetworking: {
      type: Boolean,
      default: false
    },
    hasLiveStream: {
      type: Boolean,
      default: false
    },
    hasQRCode: {
      type: Boolean,
      default: true
    },
    allowPhotos: {
      type: Boolean,
      default: true
    },
    allowReviews: {
      type: Boolean,
      default: true
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available tickets
eventSchema.virtual('availableTickets').get(function() {
  if (!this.pricing.tickets) return 0;
  return this.pricing.tickets.reduce((total, ticket) => {
    return total + (ticket.quantity - ticket.sold);
  }, 0);
});

// Virtual for total revenue
eventSchema.virtual('totalRevenue').get(function() {
  if (!this.pricing.tickets) return 0;
  return this.pricing.tickets.reduce((total, ticket) => {
    return total + (ticket.price * ticket.sold);
  }, 0);
});

// Virtual for event duration in hours
eventSchema.virtual('durationHours').get(function() {
  return Math.round(this.duration / 60 * 100) / 100;
});

// Virtual for days until event
eventSchema.virtual('daysUntilEvent').get(function() {
  const now = new Date();
  const eventDate = new Date(this.startDate);
  const diffTime = eventDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes for better performance
eventSchema.index({ title: 'text', description: 'text' });
eventSchema.index({ category: 1 });
eventSchema.index({ startDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ 'location.coordinates': '2dsphere' });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ 'seo.slug': 1 });

// Pre-save middleware to generate slug
eventSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.seo.slug) {
    this.seo.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  
  // Calculate duration if not provided
  if (this.startDate && this.endDate && !this.duration) {
    this.duration = Math.round((this.endDate - this.startDate) / (1000 * 60));
  }
  
  this.updatedAt = Date.now();
  next();
});

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function(limit = 10) {
  return this.find({
    startDate: { $gte: new Date() },
    status: 'published',
    visibility: 'public'
  })
  .sort({ startDate: 1 })
  .limit(limit)
  .populate('organizer', 'firstName lastName avatar');
};

// Static method to find events by category
eventSchema.statics.findByCategory = function(category, limit = 10) {
  return this.find({
    category,
    status: 'published',
    visibility: 'public'
  })
  .sort({ startDate: 1 })
  .limit(limit)
  .populate('organizer', 'firstName lastName avatar');
};

// Instance method to check if user is registered
eventSchema.methods.isUserRegistered = function(userId) {
  return this.attendees.some(attendee => 
    attendee.user.toString() === userId.toString()
  );
};

// Instance method to get available spots
eventSchema.methods.getAvailableSpots = function() {
  if (!this.registration.maxAttendees) return Infinity;
  return this.registration.maxAttendees - this.registration.currentAttendees;
};

module.exports = mongoose.model('Event', eventSchema);