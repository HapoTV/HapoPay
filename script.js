// Global Supabase client creation function
const createClient = () => {
  if (!window?.supabase || !window?.APP_CONFIG) return null;
  return window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_KEY);
};

// Parent signup -> send email confirmation via Supabase and redirect to login page
document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('parent-signup-form');
  const loginForm = document.getElementById('parent-login-form');

  // Handle parent signup form
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = signupForm.querySelector('.submit-btn');

      const firstName = document.getElementById('firstName').value.trim();
      const surname = document.getElementById('surname').value.trim();
      const province = document.getElementById('province').value;
      const gender = document.getElementById('gender').value;
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirmPassword').value;
      const accepted = document.getElementById('terms').checked;

      if (!accepted) {
        alert('Please accept the Terms & Conditions to continue.');
        return;
      }

      if (password !== confirm) {
        alert('Passwords do not match. Please confirm your password.');
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        alert('Supabase client not available. Please refresh the page.');
        return;
      }

      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating...'; }

        // Sign up and let Supabase send a confirmation email
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              surname: surname,
              province: province,
              gender: gender
            },
            emailRedirectTo: window.location.origin + '/parentLogin.html'
          }
        });

        if (error) throw error;

        alert('Account created! Check your email for a confirmation link. After confirming, please sign in.');
        window.location.href = 'parentLogin.html';
      } catch (err) {
        alert(err.message || 'Could not create your account. Please try again.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account'; }
      }
    });
  }

  // Handle parent login form
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = loginForm.querySelector('.submit-btn');
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe').checked;

      if (!email || !password) {
        alert('Please enter both email and password.');
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        alert('Supabase client not available. Please refresh the page.');
        return;
      }

      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing In...'; }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          if (/Email not confirmed/i.test(error.message)) {
            alert('Please confirm your email address. Check your inbox for the confirmation link.');
          } else if (/Invalid login credentials/i.test(error.message)) {
            alert('Invalid email or password. Please try again.');
          } else {
            alert('Login failed: ' + error.message);
          }
          return;
        }

        if (data.user) {
          // Handle user profile creation/update
          await handleUserProfile(data.user);
          
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          } else {
            localStorage.removeItem('rememberMe');
          }

          window.location.href = 'parentDashboard.html';
        }
      } catch (err) {
        alert('An unexpected error occurred. Please try again.');
        console.error('Login error:', err);
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In'; }
      }
    });
  }
});

// Google OAuth sign-in
async function signInWithGoogle() {
  const supabase = createClient();
  if (!supabase) {
    alert('Supabase client not available. Please refresh the page.');
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/parentDashboard.html'
      }
    });
    
    if (error) throw error;
    
    // Redirect handled by provider
  } catch (err) {
    alert('Google sign-in failed: ' + (err.message || 'Unknown error'));
  }
}

// Function to handle user profile creation/update after authentication
async function handleUserProfile(user) {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching profile:', fetchError);
    }

    let profileData = {};
    
    if (user.app_metadata?.provider === 'google') {
      const fullName = user.user_metadata?.full_name || '';
      const firstName = user.user_metadata?.first_name || '';
      const surname = user.user_metadata?.last_name || '';
      
      profileData = {
        id: user.id,
        email: user.email,
        first_name: firstName || fullName.split(' ')[0] || '',
        surname: surname || fullName.split(' ').slice(1).join(' ') || '',
        updated_at: new Date().toISOString()
      };
    } else {
      // Try to use metadata set during signUp
      const md = user.user_metadata || {};
      profileData = {
        id: user.id,
        email: user.email,
        first_name: md.first_name || md.firstName || '',
        surname: md.surname || md.last_name || md.lastName || '',
        province: md.province || null,
        gender: md.gender || null,
        updated_at: new Date().toISOString()
      };
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
    }

    return profileData;
  } catch (err) {
    console.error('Error handling user profile:', err);
    return null;
  }
}

