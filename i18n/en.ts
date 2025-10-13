export default {
  auth: {
    language: {
      en: 'English',
      pt: 'Português'
    },
    loading: 'Loading...',
    welcome_new: 'Welcome!',
    welcome_back: 'Welcome back!',
    fields: {
      name: 'Name',
      last_name: 'Last Name (Opt.)',
      birthdate: 'Birth Date',
      email: 'Email',
      username: 'Unique ID',
      email_or_username: 'Email/Unique ID',
      password: 'Password',
      confirm_password: 'Confirm Password'
    },
    buttons: {
      signup: 'Sign up',
      login: 'Login'
    },
    links: {
      have_account: 'Already have an account? ',
      no_account: "Don't have an account yet? "
    },
    status: {
      loading: 'Loading...',
      checking_username: 'Checking Unique ID...'
    },
    success: {
      check_email: 'Please check your email to verify your account.',
      verify_account: 'Please verify your account',
      login_success: 'Login successful!'
    },
    errors: {
      required_fields: 'Please fill in all required fields',
      first_name_required: 'First name is required',
      username_required: 'Unique ID is required',
      birthdate_required: 'Birth date is required',
      email_required: 'Email is required',
      invalid_email: 'Please enter a valid email address',
      password_required: 'Password is required',
  password_too_short: 'Password must be at least 8 characters, include a lowercase letter, an uppercase letter, and at least one special character.',
      login_email_required: 'Email/Unique ID cannot be empty!',
      login_password_required: 'Password is required!',
      passwords_mismatch: 'Passwords do not match',
      confirm_password_required: 'Please confirm your password',
  invalid_username: 'Unique ID must start with a letter, be 3-20 characters long, and can only contain letters, numbers, dots, underscores, and hyphens',
      username_too_short: 'Unique ID must be at least 3 characters long',
      username_unavailable: 'Please choose a different Unique ID',
      invalid_name_length: 'Names must be between 2-15 characters',
      invalid_birthdate: 'Please enter a valid birth date in DD/MM/YYYY format',
      invalid_birthdate_twentyfive: 'Birth year must be 1925 or later.',
      invalid_birthdate_age: 'We are sorry, but for safety reasons, you must be at least 13 years old to sign up to Florescer.',
      invalid_name: 'Name must have at least 2 characters and contain only letters',
  email_in_use_custom: 'This email is already in use. Please log in instead!',
  email_not_verified: 'Please verify your email address before logging in.',
  profile_info_required: 'Profile information is required for signup',
  last_name_required: 'Last name is required',
  signup_no_user: 'Signup completed but no ID was created',
  no_user_found: 'No ID found',
      rate_limit: 'Too many signup attempts. Please wait a few minutes before trying again.',
      unexpected: 'An unexpected error occurred',
      username_taken: 'This Unique ID is already taken',
      invalid_credentials: 'Invalid email/ID or password',
      onboarding: {
        errors: {
          
        }
      }
    },
    birthdate_placeholder: 'Birth Date'
  },
  settings: {
    theme: 'Theme',
    theme_value_dark: 'Dark',
    theme_value_light: 'Light',
    language: 'Language',
    manage_modules: 'Manage Modules',
    save_changes: 'Save Changes',
    saving: 'Saving...',
    modules: 'Modules ',
    title: 'Settings',
    loading_account: 'Loading account...',
    menu: {
      account: 'Account',
      florescer_plus: 'Florescer+',
      general: 'General ',
      help: 'Help'
    }
  },
  profile: {
    title: 'Profile',
    placeholders: {
      email: 'exemple@email.com'
    },
    actions: {
      change_password: 'Change password',
      change_email: 'Change email'
    },
    buttons: {
      update_profile: 'Update profile'
    },
    success: {
      image_updated: 'Profile image updated!',
      profile_updated: 'Profile updated!',
      reset_sent: 'Password reset email sent',
      email_change_requested: 'Check your inbox to confirm the new email'
    },
    errors: {
      photo_permission: 'Photo library permission is required to choose an image',
      user_not_found: 'User not found',
  no_email_on_account: 'No email associated with this account',
      upload_failed: 'Failed to upload image',
      network_error: 'Network error while uploading image',
      update_failed: 'Failed to update profile',
  update_failed_generic: 'Failed to update your profile',
  failed_something: 'Something went wrong. Please try again later.',
      generic_image_error: 'An error occurred while processing the image'
    }
    ,
    dialogs: {
      enter_new_email: 'Enter new email address'
    }
  },
  common: {
    cancel: ' Cancel ',
    confirm: ' Confirm '
  },
  auth_logout: {
    title: 'Logout',
    message: 'Are you sure you want to log out?',
    cancel: 'Cancel',
    confirm: 'Logout'
  },
  image_cropper: {
    title: 'Pick from',
    camera: 'Camera',
    gallery: 'Gallery',
    remove: 'Remove',
    permission_title: 'Permission needed',
    permission_camera: 'Camera permission is required to take photos',
    permission_gallery: 'Gallery permission is required to select photos',
    error_title: 'Error',
    error_select_failed: 'Failed to select image'
  },
  modules: {
    messages: 'Messages',
    partnership: 'Partnership',
  delete_confirm: 'Remove {{module}}?',
  delete_message: 'Removing the module {{module}} will permanently delete all data associated with it. This action cannot be undone.',
  no_more_modules: 'No additional active modules',
    bromelia: 'Bromélia',
    pomodoro: 'Pomodoro',
    journal: 'Journal',
  addictions: 'Addictions',
  recovery: 'Recovery',
  focusmode: 'Focus Mode',
  planner: 'Planner',
  taskmanager: 'Tasks',
  habits: 'Habits',
  minimalapps: 'Minimal Apps',
  applimits: 'App Limits',
  moodtracker: 'Mood Tracker'
  },
  chat: {
    type_message: 'Chat with Bromélia...'
  },
  tabs: {
    home: 'Home',
    more: 'More'
  },
  home: {
  day_streak: 'Day Streak',
  screen_time: 'Screen Time Today',
  goals_met: 'Goals Met',
  partner: 'Partner',
  no_partner: 'No Partner',
  daily_checkin_title: 'Daily Check-in ',
    checkin_prompt: 'Ready to start your productive day?',
    check_in_now: 'Check In Now',
    great_job: ' Great job!✨ ',
    checked_in_message: "You've checked in for today. Keep up the momentum!",
    streak_maintained: 'Streak maintained'
  },
  onboarding: {
  welcome_title: 'Welcome to Florescer!',
  welcome_subtitle: "Let's get you started.",
  step1_heading: 'What brings you to the app?',
  option_wellness_title: 'Wellness',
  option_wellness_desc: 'Guided routines and gentle exercises to support your emotional health, with Bromélia assistance.',
  option_productivity_title: 'Productivity',
  option_productivity_desc: 'Tools like a planner, focused timers, and task lists to help you get things done.',
  next: 'Next',
  back: 'Back',
  signup: 'Sign up',
  step2_heading: 'Great! Now, select the modules you want to use:',
  option_general_title: 'General Wellness',
  option_general_desc: 'Habits, Journal, Bromélia, Mood Tracker, Minimal apps.',
  option_challenges_title: 'Recovery & Challenges',
  option_challenges_desc: 'Recovery tools, Journal, Minimal apps.',
  option_productivity_secondary_title: 'General Productivity',
  option_productivity_secondary_desc: 'Focus Mode, Planner, Tasks, Pomodoro.',
  modules_note: 'You can change modules later in Settings.',
  change_plan: 'Change plan',
  no_plan: 'Select plan',
  errors: {
    no_plan_selected: 'Please select a plan to continue'
  }
  },
  header: {
    good_morning: 'Good Morning',
    good_afternoon: 'Good Afternoon',
    good_evening: 'Good Evening'
  }
  ,
  journal: {
    intro_title: 'Try journaling',
    intro_body: 'Journaling is a simple, therapeutic practice that helps you process emotions, reduce stress, and notice patterns over time. Try writing a quick entry. Even a few sentences can bring clarity and calm.',
    write_button: 'Write'
  }
} as const;
