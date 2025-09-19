# Dynamic Event Hub 🎉

A comprehensive MEAN stack event management platform with real-time features, user authentication, payment integration, and dynamic content management.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization** (JWT-based)
- **Real-time Event Updates** (Socket.io)
- **Dynamic Event Creation & Management**
- **Advanced Search & Filtering**
- **Payment Integration** (Stripe-ready)
- **File Upload & Media Management**
- **Email Notifications**
- **Analytics Dashboard**
- **Mobile-Responsive Design**

### Advanced Features
- **Real-time Chat** for events
- **QR Code Generation** for tickets
- **Geolocation Services**
- **Social Media Integration**
- **Multi-language Support**
- **Dark/Light Theme Toggle**
- **Progressive Web App (PWA)**

## 🛠️ Tech Stack

- **MongoDB** - Database
- **Express.js** - Backend Framework
- **Angular 17** - Frontend Framework
- **Node.js** - Runtime Environment
- **Socket.io** - Real-time Communication
- **JWT** - Authentication
- **Multer** - File Uploads
- **Nodemailer** - Email Service
- **Stripe** - Payment Processing

## 📦 Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (v6+)
- Angular CLI (v17+)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure your environment variables
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
ng serve
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/user/:id` - Get user bookings

## 🚀 Deployment

### Docker
```bash
docker-compose up -d
```

### Manual Deployment
1. Build Angular app: `ng build --prod`
2. Deploy backend to your server
3. Configure MongoDB connection
4. Set up environment variables

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Created with ❤️ by [Your Name]

---

⭐ Star this repo if you find it helpful!