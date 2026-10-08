import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const loginForm = document.getElementById('loginForm');
const resetPasswordForm = document.getElementById('resetPasswordForm');
const signedInPanel = document.getElementById('signedInPanel');
const loginMessage = document.getElementById('loginMessage');
const resetMessage = document.getElementById('resetMessage');
const signedInMessage = document.getElementById('signedInMessage');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const resetSubmitBtn = document.getElementById('resetSubmitBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const signOutBtn = document.getElementById('signOutBtn');

function setMessage(element, text, type = 'error') {
  element.textContent = text;
  element.dataset.type = type;
  element.hidden = false;
}

function clearMessage(element) {
  element.textContent = '';
  element.hidden = true;
}

function showSignedIn(user) {
  loginForm.hidden = true;
  resetPasswordForm.hidden = true;
  signedInPanel.hidden = false;
  document.getElementById('signedInEmail').textContent = user.email || 'Your account';
}

function showLogin() {
  loginForm.hidden = false;
  resetPasswordForm.hidden = true;
  signedInPanel.hidden = true;
}

function isPasswordRecovery() {
  return new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(loginMessage);
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = 'Signing in…';

  const formData = new FormData(loginForm);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.get('email').trim(),
      password: formData.get('password')
    });

    if (error) {
      setMessage(loginMessage, error.message);
      return;
    }

    if (data.user) showSignedIn(data.user);
  } catch (error) {
    setMessage(loginMessage, error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = 'Sign In';
  }
});

forgotPasswordBtn.addEventListener('click', async () => {
  clearMessage(loginMessage);
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    setMessage(loginMessage, 'Enter your email address first, then choose “Forgot password?”.');
    document.getElementById('loginEmail').focus();
    return;
  }

  forgotPasswordBtn.disabled = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split('#')[0]
    });

    if (error) {
      setMessage(loginMessage, error.message);
      return;
    }

    setMessage(loginMessage, 'If an account exists for this email, a password reset link has been sent.', 'success');
  } catch (error) {
    setMessage(loginMessage, error instanceof Error ? error.message : 'Could not request a password reset. Please try again.');
  } finally {
    forgotPasswordBtn.disabled = false;
  }
});

resetPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(resetMessage);
  const password = document.getElementById('newPassword').value;
  const confirmation = document.getElementById('confirmPassword').value;
  if (password !== confirmation) {
    setMessage(resetMessage, 'The passwords do not match.');
    return;
  }

  resetSubmitBtn.disabled = true;
  try {
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(resetMessage, error.message);
      return;
    }

    if (data.user) showSignedIn(data.user);
    setMessage(signedInMessage, 'Your password has been updated.', 'success');
  } catch (error) {
    setMessage(resetMessage, error instanceof Error ? error.message : 'Could not update your password. Please try again.');
  } finally {
    resetSubmitBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', async () => {
  clearMessage(signedInMessage);
  signOutBtn.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(signedInMessage, error.message);
      return;
    }
    showLogin();
    setMessage(loginMessage, 'You have signed out.', 'success');
  } catch (error) {
    setMessage(signedInMessage, error instanceof Error ? error.message : 'Could not sign out. Please try again.');
  } finally {
    signOutBtn.disabled = false;
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' || isPasswordRecovery()) {
    loginForm.hidden = true;
    signedInPanel.hidden = true;
    resetPasswordForm.hidden = false;
    return;
  }

  if (event === 'SIGNED_OUT') {
    showLogin();
    return;
  }

  if (session && event === 'SIGNED_IN') showSignedIn(session.user);
});

try {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    setMessage(loginMessage, sessionError.message);
  } else if (isPasswordRecovery()) {
    loginForm.hidden = true;
    resetPasswordForm.hidden = false;
  } else if (sessionData.session) {
    showSignedIn(sessionData.session.user);
  }
} catch (error) {
  setMessage(loginMessage, error instanceof Error ? error.message : 'Could not check your account session.');
}
