import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { t, type Lang } from '../i18n';
import { recordConsent, PRIVACY_URL, TERMS_URL } from '../auth/consent'; // [+ CONSENT]

interface LoginScreenProps {
  language: Lang;
  onLanguageChange: (lang: Lang) => void;
  onContinue: () => void;
}

export function LoginScreen({ language, onLanguageChange, onContinue }: LoginScreenProps) {
  const { status, signInWithGoogle, signInWithApple } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ko = language === 'ko';

  const [signingIn, setSigningIn] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setSigningIn(true);
    recordConsent();
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error('[LoginScreen] Google sign-in error:', e);
      if (e?.code !== 'auth/popup-closed-by-user') {
        setError(e?.message ?? 'Login failed');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setSigningIn(true);
    recordConsent();
    try {
      await signInWithApple();
    } catch (e: any) {
      console.error('[LoginScreen] Apple sign-in error:', e);
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== '1001') {
        setError(e?.message ?? 'Login failed');
      }
    } finally {
      setSigningIn(false);
    }
  };

  // If already authed (e.g. returning Google user), auto-proceed
  if (status === 'authed' || status === 'needsName') {
    Promise.resolve().then(onContinue);
    return null;
  }

  return (
    <section className="login-screen">
      <div className="login-screen__content">
        <h1 className="login-screen__title">Cosmic Coalescence</h1>
        <p className="login-screen__tagline">{t(language, 'introTagline')}</p>

        <div className="login-screen__actions">
          <button
            className="login-screen__google-btn"
            type="button"
            onClick={handleGoogle}
            disabled={signingIn || status === 'loading'}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{ko ? 'Google로 계속하기' : 'Continue with Google'}</span>
          </button>

          <button
            className="login-screen__apple-btn"
            type="button"
            onClick={handleApple}
            disabled={signingIn || status === 'loading'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M16.365 1.43c0 1.14-.42 2.2-1.13 2.99-.77.86-2.02 1.52-3.06 1.44-.13-1.09.42-2.24 1.1-2.97.77-.83 2.1-1.45 3.09-1.46.01.001.01.001 0 0zM20.79 17.06c-.57 1.31-.84 1.89-1.57 3.05-1.02 1.62-2.46 3.64-4.25 3.65-1.58.01-1.99-1.03-4.13-1.02-2.14.01-2.59 1.04-4.18 1.03-1.79-.01-3.15-1.83-4.17-3.45-2.86-4.53-3.16-9.85-1.39-12.68 1.25-2.01 3.23-3.19 5.09-3.19 1.89 0 3.08 1.04 4.65 1.04 1.52 0 2.45-1.04 4.64-1.04 1.65 0 3.4.9 4.65 2.45-4.09 2.24-3.43 8.08.66 10.16z"/>
            </svg>
            <span>{ko ? 'Apple로 계속하기' : 'Continue with Apple'}</span>
          </button>

          {status === 'loading' && <p className="login-screen__status">{ko ? '연결 중...' : 'Connecting...'}</p>}
          {signingIn && <p className="login-screen__status">{ko ? '로그인 중...' : 'Signing in...'}</p>}
          {error && <p className="login-screen__error">{error}</p>}
          {status === 'signedOut' && error && <p className="login-screen__error">{error}</p>}
        </div>

        {/* [+ CONSENT] Store-required notice. Tapping a sign-in button = acceptance. */}
        <p
          className="login-screen__consent"
          style={{ marginTop: 18, maxWidth: 300, fontSize: 12, lineHeight: 1.5, color: '#9b93ad', textAlign: 'center' }}
        >
          {ko ? (
            <>
              계속하면{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#b9a8e0' }}>서비스 약관</a>
              과{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#b9a8e0' }}>개인정보처리방침</a>
              에 동의하는 것으로 간주됩니다.
            </>
          ) : (
            <>
              By continuing, you agree to our{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#b9a8e0' }}>Terms of Service</a>
              {' '}and{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#b9a8e0' }}>Privacy Policy</a>.
            </>
          )}
        </p>

        <div className="login-screen__bottom">
          <button
            className={`login-screen__lang-btn ${language === 'en' ? 'login-screen__lang-btn--active' : ''}`}
            type="button"
            onClick={() => onLanguageChange('en')}
            title="English"
          >
            🇺🇸
          </button>
          <button
            className={`login-screen__lang-btn ${language === 'ko' ? 'login-screen__lang-btn--active' : ''}`}
            type="button"
            onClick={() => onLanguageChange('ko')}
            title="한국어"
          >
            🇰🇷
          </button>
        </div>
      </div>
    </section>
  );
}
