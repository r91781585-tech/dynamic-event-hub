import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';
import { CookieService } from 'ngx-cookie-service';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'organizer' | 'admin';
  isEmailVerified: boolean;
  avatar?: string;
  lastLogin?: Date;
  fullName?: string;
  bio?: string;
  phone?: string;
  preferences?: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private tokenRefreshTimer: any;

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private cookieService: CookieService
  ) {
    this.initializeAuth();
  }

  /**
   * Initialize authentication state from stored token
   */
  private initializeAuth(): void {
    const token = this.getStoredToken();
    if (token && this.isTokenValid(token)) {
      this.setAuthState(token);
      this.loadUserProfile();
      this.scheduleTokenRefresh(token);
    } else {
      this.clearAuthState();
    }
  }

  /**
   * Check current authentication status
   */
  checkAuthStatus(): void {
    const token = this.getStoredToken();
    if (token && this.isTokenValid(token)) {
      this.loadUserProfile();
    }
  }

  /**
   * Login user with email and password
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/login\`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.data.token) {
            this.handleAuthSuccess(response.data.token, response.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Register new user
   */
  register(userData: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/register\`, userData)
      .pipe(
        tap(response => {
          if (response.success && response.data.token) {
            this.handleAuthSuccess(response.data.token, response.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Logout user
   */
  logout(): Observable<any> {
    return this.http.post(\`\${this.API_URL}/auth/logout\`, {})
      .pipe(
        tap(() => this.handleLogout()),
        catchError(() => {
          // Even if logout request fails, clear local state
          this.handleLogout();
          return throwError(() => new Error('Logout failed'));
        })
      );
  }

  /**
   * Get current user profile
   */
  getUserProfile(): Observable<{ success: boolean; data: { user: User } }> {
    return this.http.get<{ success: boolean; data: { user: User } }>(\`\${this.API_URL}/auth/profile\`)
      .pipe(
        tap(response => {
          if (response.success) {
            this.currentUserSubject.next(response.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Update user profile
   */
  updateProfile(profileData: Partial<User>): Observable<any> {
    return this.http.put(\`\${this.API_URL}/auth/profile\`, profileData)
      .pipe(
        tap(response => {
          if (response.success) {
            const currentUser = this.currentUserSubject.value;
            if (currentUser) {
              this.currentUserSubject.next({ ...currentUser, ...response.data.user });
            }
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Change password
   */
  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(\`\${this.API_URL}/auth/change-password\`, {
      currentPassword,
      newPassword
    }).pipe(catchError(this.handleError));
  }

  /**
   * Request password reset
   */
  forgotPassword(email: string): Observable<any> {
    return this.http.post(\`\${this.API_URL}/auth/forgot-password\`, { email })
      .pipe(catchError(this.handleError));
  }

  /**
   * Reset password with token
   */
  resetPassword(token: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/reset-password/\${token}\`, { password })
      .pipe(
        tap(response => {
          if (response.success && response.data.token) {
            this.handleAuthSuccess(response.data.token, response.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Verify email with token
   */
  verifyEmail(token: string): Observable<any> {
    return this.http.post(\`\${this.API_URL}/auth/verify-email/\${token}\`, {})
      .pipe(catchError(this.handleError));
  }

  /**
   * Refresh authentication token
   */
  refreshToken(): Observable<AuthResponse> {
    const currentToken = this.getStoredToken();
    if (!currentToken) {
      return throwError(() => new Error('No token available'));
    }

    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/refresh\`, { token: currentToken })
      .pipe(
        tap(response => {
          if (response.success && response.data.token) {
            this.storeToken(response.data.token);
            this.scheduleTokenRefresh(response.data.token);
          }
        }),
        catchError(error => {
          this.handleLogout();
          return throwError(() => error);
        })
      );
  }

  /**
   * Get current user value
   */
  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Get stored authentication token
   */
  getToken(): string | null {
    return this.getStoredToken();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    return user ? user.role === role : false;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: string[]): boolean {
    const user = this.currentUserValue;
    return user ? roles.includes(user.role) : false;
  }

  /**
   * Navigate to login page
   */
  redirectToLogin(): void {
    this.router.navigate(['/login']);
  }

  /**
   * Handle successful authentication
   */
  private handleAuthSuccess(token: string, user: User): void {
    this.storeToken(token);
    this.setAuthState(token);
    this.currentUserSubject.next(user);
    this.scheduleTokenRefresh(token);
  }

  /**
   * Handle logout
   */
  private handleLogout(): void {
    this.clearAuthState();
    this.clearTokenRefreshTimer();
    this.router.navigate(['/login']);
  }

  /**
   * Set authentication state
   */
  private setAuthState(token: string): void {
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Clear authentication state
   */
  private clearAuthState(): void {
    this.removeStoredToken();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Load user profile from API
   */
  private loadUserProfile(): void {
    this.getUserProfile().subscribe({
      next: (response) => {
        if (response.success) {
          this.currentUserSubject.next(response.data.user);
        }
      },
      error: () => {
        this.clearAuthState();
      }
    });
  }

  /**
   * Store token in secure storage
   */
  private storeToken(token: string): void {
    // Store in httpOnly cookie for security (if supported)
    if (environment.production) {
      this.cookieService.set(this.TOKEN_KEY, token, {
        expires: 7, // 7 days
        secure: true,
        sameSite: 'Strict'
      });
    } else {
      // Development: store in localStorage
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  /**
   * Get stored token
   */
  private getStoredToken(): string | null {
    if (environment.production) {
      return this.cookieService.get(this.TOKEN_KEY) || null;
    } else {
      return localStorage.getItem(this.TOKEN_KEY);
    }
  }

  /**
   * Remove stored token
   */
  private removeStoredToken(): void {
    if (environment.production) {
      this.cookieService.delete(this.TOKEN_KEY);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  /**
   * Check if token is valid and not expired
   */
  private isTokenValid(token: string): boolean {
    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch {
      return false;
    }
  }

  /**
   * Schedule token refresh before expiry
   */
  private scheduleTokenRefresh(token: string): void {
    try {
      const decoded: any = jwtDecode(token);
      const expiryTime = decoded.exp * 1000;
      const refreshTime = expiryTime - this.REFRESH_THRESHOLD;
      const delay = refreshTime - Date.now();

      if (delay > 0) {
        this.clearTokenRefreshTimer();
        this.tokenRefreshTimer = timer(delay).pipe(
          switchMap(() => this.refreshToken())
        ).subscribe();
      }
    } catch (error) {
      console.error('Error scheduling token refresh:', error);
    }
  }

  /**
   * Clear token refresh timer
   */
  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      this.tokenRefreshTimer.unsubscribe();
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.status === 401) {
        this.handleLogout();
        errorMessage = 'Authentication failed';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = \`Server error: \${error.status}\`;
      }
    }

    console.error('Auth Service Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };
}