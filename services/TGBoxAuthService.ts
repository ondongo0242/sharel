import { AuthService } from './AuthService';
import { TGBoxApiService } from './TGBoxApiService';

class TGBoxAuthServiceClass {
  private isInitializing = false;

  async initializeTGBox(): Promise<boolean> {
    if (this.isInitializing) return false;
    
    try {
      this.isInitializing = true;

      const user = await AuthService.getUser();
      
      if (!user) {
        console.log('[TGBoxAuth] User not authenticated');
        return false;
      }

      TGBoxApiService.setUserInfo(user.id, user.email || '');
      
      // Don't auto-fetch on startup - let user configure URLs first
      console.log('[TGBoxAuth] TGBox ready with user:', user.email);
      return true;

    } catch (error) {
      console.error('[TGBoxAuth] Error during initialization:', error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  async signUpAndInitTGBox(
    email: string,
    password: string,
    fullName: string,
    username: string,
    phoneNumber: string
  ): Promise<any> {
    try {
      const signUpResult = await AuthService.signUp({
        email,
        password,
        fullName,
        username,
        phoneNumber,
        mobileProvider: 'mtn',
      });

      if (!signUpResult.success) {
        return signUpResult;
      }

      if (signUpResult.user) {
        TGBoxApiService.setUserInfo(signUpResult.user.id, email);
        await this.initializeTGBox();
      }

      return signUpResult;
    } catch (error) {
      console.error('[TGBoxAuth] Error signup:', error);
      return { success: false, error: 'Initialization error' };
    }
  }
}

export const TGBoxAuthService = new TGBoxAuthServiceClass();
