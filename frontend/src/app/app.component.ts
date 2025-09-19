import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { SocketService } from './core/services/socket.service';
import { NotificationService } from './core/services/notification.service';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container" [class.dark-theme]="isDarkTheme">
      <!-- Loading Spinner -->
      <ngx-spinner 
        bdColor="rgba(0, 0, 0, 0.8)" 
        size="medium" 
        color="#fff" 
        type="ball-scale-multiple">
        <p style="color: white">Loading...</p>
      </ngx-spinner>

      <!-- Navigation -->
      <app-navbar *ngIf="showNavbar"></app-navbar>

      <!-- Main Content -->
      <main class="main-content" [class.with-navbar]="showNavbar">
        <router-outlet></router-outlet>
      </main>

      <!-- Footer -->
      <app-footer *ngIf="showFooter"></app-footer>

      <!-- Notification Container -->
      <div class="notification-container">
        <!-- Toast notifications will be rendered here -->
      </div>

      <!-- PWA Update Available Banner -->
      <div class="pwa-update-banner" *ngIf="showPwaUpdateBanner">
        <div class="banner-content">
          <span>A new version is available!</span>
          <button class="update-btn" (click)="updatePwa()">Update</button>
          <button class="dismiss-btn" (click)="dismissPwaUpdate()">×</button>
        </div>
      </div>

      <!-- Offline Indicator -->
      <div class="offline-indicator" *ngIf="!isOnline">
        <mat-icon>wifi_off</mat-icon>
        <span>You're offline</span>
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
    }

    .main-content {
      flex: 1;
      transition: all 0.3s ease;
    }

    .main-content.with-navbar {
      margin-top: 64px; /* Height of navbar */
    }

    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
    }

    .pwa-update-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #2196f3;
      color: white;
      padding: 16px;
      z-index: 1000;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    }

    .banner-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1200px;
      margin: 0 auto;
    }

    .update-btn {
      background: white;
      color: #2196f3;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      margin-left: 16px;
    }

    .dismiss-btn {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      margin-left: 16px;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .offline-indicator {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: #f44336;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    /* Dark Theme Styles */
    .dark-theme {
      background-color: #121212;
      color: #ffffff;
    }

    .dark-theme .main-content {
      background-color: #121212;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .main-content.with-navbar {
        margin-top: 56px; /* Smaller navbar height on mobile */
      }

      .banner-content {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }

      .update-btn {
        margin-left: 0;
      }
    }

    /* Loading States */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    /* Smooth Transitions */
    * {
      transition: background-color 0.3s ease, color 0.3s ease;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Dynamic Event Hub';
  isDarkTheme = false;
  showNavbar = true;
  showFooter = true;
  showPwaUpdateBanner = false;
  isOnline = navigator.onLine;
  
  private destroy$ = new Subject<void>();
  private swUpdate: any;

  constructor(
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private socketService: SocketService,
    private notificationService: NotificationService,
    private loadingService: LoadingService
  ) {
    this.initializeApp();
  }

  ngOnInit(): void {
    this.setupRouterEvents();
    this.setupThemeSubscription();
    this.setupAuthSubscription();
    this.setupSocketConnection();
    this.setupNetworkStatus();
    this.setupPwaUpdate();
    this.initializeNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.disconnect();
  }

  private initializeApp(): void {
    // Initialize theme
    this.themeService.initializeTheme();
    
    // Check authentication status
    this.authService.checkAuthStatus();
    
    // Initialize loading service
    this.loadingService.initialize();
  }

  private setupRouterEvents(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        // Hide navbar and footer on certain routes
        const hideNavbarRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
        const hideFooterRoutes = ['/dashboard', '/admin'];
        
        this.showNavbar = !hideNavbarRoutes.some(route => event.url.startsWith(route));
        this.showFooter = !hideFooterRoutes.some(route => event.url.startsWith(route));
        
        // Scroll to top on route change
        window.scrollTo(0, 0);
        
        // Update page title
        this.updatePageTitle(event.url);
      });
  }

  private setupThemeSubscription(): void {
    this.themeService.isDarkTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isDark => {
        this.isDarkTheme = isDark;
        document.body.classList.toggle('dark-theme', isDark);
      });
  }

  private setupAuthSubscription(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          // User is authenticated, connect to socket
          this.socketService.connect();
        } else {
          // User is not authenticated, disconnect socket
          this.socketService.disconnect();
        }
      });
  }

  private setupSocketConnection(): void {
    this.socketService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        if (status === 'connected') {
          console.log('Socket connected successfully');
        } else if (status === 'disconnected') {
          console.log('Socket disconnected');
        }
      });

    // Listen for real-time notifications
    this.socketService.on('notification')
      .pipe(takeUntil(this.destroy$))
      .subscribe(notification => {
        this.notificationService.showNotification(notification);
      });
  }

  private setupNetworkStatus(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notificationService.showSuccess('Connection restored');
      this.socketService.reconnect();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notificationService.showWarning('You are offline');
    });
  }

  private setupPwaUpdate(): void {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }

  private initializeNotifications(): void {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private updatePageTitle(url: string): void {
    let title = 'Dynamic Event Hub';
    
    const routeTitles: { [key: string]: string } = {
      '/': 'Home',
      '/events': 'Events',
      '/dashboard': 'Dashboard',
      '/profile': 'Profile',
      '/login': 'Login',
      '/register': 'Register',
      '/about': 'About Us',
      '/contact': 'Contact'
    };

    const matchedRoute = Object.keys(routeTitles).find(route => 
      url === route || (route !== '/' && url.startsWith(route))
    );

    if (matchedRoute) {
      title = \`\${routeTitles[matchedRoute]} - Dynamic Event Hub\`;
    }

    document.title = title;
  }

  updatePwa(): void {
    if (this.swUpdate) {
      this.swUpdate.activateUpdate().then(() => {
        window.location.reload();
      });
    }
  }

  dismissPwaUpdate(): void {
    this.showPwaUpdateBanner = false;
  }
}