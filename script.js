// Global Supabase client creation function (resilient)
const createClient = () => {
  try {
    // Return cached instance if available
    if (window._supabaseClient) return window._supabaseClient;

    // Determine config from window or built-in fallback
    const fallbackUrl = 'https://ckyncyqsakqevzeqgwgv.supabase.co';
    const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreW5jeXFzYWtxZXZ6ZXFnd2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NzE2MTUsImV4cCI6MjA3MTM0NzYxNX0.t32UWdoe6w9b-OYfxb_FcTWTwvGJP-uIndGATxWOowQ';
    const cfg = (window && window.APP_CONFIG) ? window.APP_CONFIG : { SUPABASE_URL: fallbackUrl, SUPABASE_KEY: fallbackKey };

    if (!window?.supabase) {
      console.error('Supabase library not loaded yet (CDN). If on a restricted network, ensure CDN access.');
      return null;
    }

    window._supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
    return window._supabaseClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
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
      const countryCode = document.getElementById('countryCode').value;
      const mobile = document.getElementById('mobile').value.trim();
      const defaultCurrency = document.getElementById('defaultCurrency').value;
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
        
        // Add debug logging
        console.log('Attempting signup with:', { email, defaultCurrency });

        // Sign up and let Supabase send a confirmation email
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/parentLogin.html`,
            data: {
              first_name: firstName,
              surname: surname,
              province: province,
              gender: gender,
              phone_country_code: countryCode,
              phone_number: mobile,
              default_currency: defaultCurrency
            }
          }
        });

        if (error) throw error;

        console.log('Signup response:', data);
        
        // Check if email confirmation is required
        if (data.user && !data.user.email_confirmed_at) {
          alert('Account created! Please check your email (including spam folder) for a confirmation link. After confirming, you can sign in.');
        } else {
          alert('Account created successfully! You can now sign in.');
        }
        
        window.location.href = 'parentLogin.html';
      } catch (err) {
        console.error('Signup error:', err);
        if (err.message && err.message.includes('fetch')) {
          alert('Network error: Please check your internet connection and try again.');
        } else {
          alert(err.message || 'Could not create your account. Please try again.');
        }
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

        console.log('Login attempt result:', { data, error });

        if (error) {
          console.error('Login error details:', error);
          
          // Check if it's really an email confirmation issue
          if (/Email not confirmed/i.test(error.message) || error.message.includes('email_not_confirmed')) {
            // Try to resend confirmation with proper redirect
            try {
              const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: email,
                options: {
                  emailRedirectTo: `${window.location.origin}/parentLogin.html`
                }
              });
              
              if (resendError) {
                console.error('Resend error:', resendError);
                alert('Email confirmation issue detected. Please check your email and click the confirmation link. If you need help, contact support.');
              } else {
                alert('A fresh confirmation email has been sent. Please check your inbox and click the new confirmation link to activate your account.');
              }
            } catch (resendErr) {
              console.error('Resend failed:', resendErr);
              alert('Email confirmation required. Please check your inbox for the confirmation link.');
            }
          } else if (/Invalid login credentials/i.test(error.message)) {
            alert('Invalid email or password. Please try again.');
          } else {
            alert('Login failed: ' + error.message);
          }
          return;
        }

        // Additional check for email confirmation
        if (data.user && !data.user.email_confirmed_at) {
          alert('Your email address needs to be confirmed. Please check your inbox for the confirmation link.');
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
    console.log('handleUserProfile called with user metadata:', user.user_metadata);
    
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
        default_currency: user.user_metadata?.default_currency || 'USD',
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
        phone_country_code: md.phone_country_code || null,
        phone_number: md.phone_number || null,
        default_currency: md.default_currency || 'USD',
        updated_at: new Date().toISOString()
      };
    }

    // Always ensure currency is saved to profile from user metadata
    if (user.user_metadata?.default_currency) {
      profileData.default_currency = user.user_metadata.default_currency;
      console.log('Overriding currency with user metadata:', user.user_metadata.default_currency);
    }

    console.log('About to save profile with data:', profileData);

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
    } else {
      console.log('Profile saved successfully with currency:', profileData.default_currency);
    }

    return profileData;
  } catch (err) {
    console.error('Error handling user profile:', err);
    return null;
  }
}

// Multi-currency functionality
function updateCurrencyFromPhone() {
  const countryCodeSelect = document.getElementById('countryCode');
  const currencySelect = document.getElementById('defaultCurrency');
  const currencyNote = document.getElementById('currencyNote');
  
  if (!countryCodeSelect || !currencySelect) return;
  
  const selectedOption = countryCodeSelect.options[countryCodeSelect.selectedIndex];
  const suggestedCurrency = selectedOption.getAttribute('data-currency');
  
  if (suggestedCurrency) {
    currencySelect.value = suggestedCurrency;
    currencyNote.textContent = `Currency auto-selected as ${suggestedCurrency} based on your phone number. You can change this if needed.`;
  }
}

// Initialize currency selection on page load
document.addEventListener('DOMContentLoaded', () => {
  // Set initial currency based on default country code
  setTimeout(() => {
    updateCurrencyFromPhone();
  }, 100);
  
  // Scroll animation for Get in Touch section
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('slide-in');
      }
    });
  }, observerOptions);
  
  const getInTouchImage = document.querySelector('.get-in-touch-image');
  const getInTouchContent = document.querySelector('.get-in-touch-content');
  
  if (getInTouchImage) {
    observer.observe(getInTouchImage);
  }
  
  if (getInTouchContent) {
    observer.observe(getInTouchContent);
  }
});

