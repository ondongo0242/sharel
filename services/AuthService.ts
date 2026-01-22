import { supabase } from '@/lib/supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
  session?: Session;
}

export interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone_number: string;
  phone_prefix: string;
  mobile_provider: 'mtn' | 'airtel';
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  username: string;
  phoneNumber: string;
  mobileProvider: 'mtn' | 'airtel';
}

class AuthServiceClass {
  async signUp(emailOrData: string | SignUpData, password?: string): Promise<AuthResult> {
    try {
      let signUpEmail: string;
      let signUpPassword: string;
      let metadata: Record<string, string> | undefined;

      if (typeof emailOrData === 'object') {
        signUpEmail = emailOrData.email;
        signUpPassword = emailOrData.password;
        metadata = {
          full_name: emailOrData.fullName,
          username: emailOrData.username,
          phone_number: emailOrData.phoneNumber,
          mobile_provider: emailOrData.mobileProvider,
        };
      } else {
        signUpEmail = emailOrData;
        signUpPassword = password || '';
      }

      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: metadata ? {
          data: metadata,
        } : undefined,
      });

      if (error) {
        console.error('Auth signup error:', error);
        return { success: false, error: this.getErrorMessage(error) };
      }

      // Créer explicitement le profil utilisateur dans la table user_profiles
      if (data.user && metadata) {
        const phonePrefix = '+242';
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            id: data.user.id,
            full_name: metadata.full_name,
            username: metadata.username,
            email: signUpEmail,
            phone_number: metadata.phone_number,
            phone_prefix: phonePrefix,
            mobile_provider: metadata.mobile_provider,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          // On continue quand même car l'auth a réussi
        } else {
          console.log('User profile created successfully');
        }
      }

      return {
        success: true,
        user: data.user ?? undefined,
        session: data.session ?? undefined,
      };
    } catch (err) {
      console.error('Signup exception:', err);
      return { success: false, error: 'Une erreur inattendue est survenue' };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: this.getErrorMessage(error) };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    } catch (err) {
      return { success: false, error: 'Une erreur inattendue est survenue' };
    }
  }

  async signOut(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: this.getErrorMessage(error) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Une erreur inattendue est survenue' };
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const { data } = await supabase.auth.getUser();
      return data.user;
    } catch {
      return null;
    }
  }

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const user = await this.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (err) {
      console.error('Error in getUserProfile:', err);
      return null;
    }
  }

  async updateUserProfile(updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>): Promise<AuthResult> {
    try {
      const user = await this.getUser();
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Une erreur inattendue est survenue' };
    }
  }

  async resetPassword(email: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        return { success: false, error: this.getErrorMessage(error) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Une erreur inattendue est survenue' };
    }
  }

  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }

  private getErrorMessage(error: AuthError): string {
    const messages: Record<string, string> = {
      'Invalid login credentials': 'Email ou mot de passe incorrect',
      'Email not confirmed': 'Veuillez confirmer votre email',
      'User already registered': 'Cet email est déjà utilisé',
      'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères',
      'Invalid email': 'Email invalide',
      'Email rate limit exceeded': 'Trop de tentatives, veuillez réessayer plus tard',
      'over_email_send_rate_limit': 'Trop de tentatives d\'inscription. Attendez quelques minutes.',
    };

    // Chercher le message d'erreur
    let errorMsg = error.message || error.code || JSON.stringify(error);
    
    if (messages[errorMsg]) {
      return messages[errorMsg];
    }

    // Chercher dans le code aussi
    if (error.code && messages[error.code]) {
      return messages[error.code];
    }

    return errorMsg || 'Une erreur est survenue';
  }
}

export const AuthService = new AuthServiceClass();
