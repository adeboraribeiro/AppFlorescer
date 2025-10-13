export default {
  auth: {
    language: {
      en: 'English',
      pt: 'Português',
      es: 'Español'
    },
    loading: 'Cargando...',
    welcome_new: '¡Bienvenid{{o}}!',
    welcome_back: '¡Bienvenid{{o}} de nuevo!',
    fields: {
      name: 'Nombre',
      last_name: 'Apellido (Opc.)',
      birthdate: 'Fecha de nacimiento',
      email: 'Correo electrónico',
      username: 'ID Único',
      email_or_username: 'Correo electrónico/ID Único',
      password: 'Contraseña',
      confirm_password: 'Confirmar contraseña'
    },
    buttons: {
      signup: 'Registrarse',
      login: ' Iniciar sesión '
    },
    links: {
      have_account: '¿Ya tienes una cuenta? ',
      no_account: '¿No tienes una cuenta? '
    },
    status: {
      loading: 'Cargando...',
      checking_username: 'Verificando ID Único...'
    },
    success: {
      check_email: 'Por favor, verifica tu correo electrónico para confirmar tu cuenta.',
      verify_account: 'Por favor, verifica tu cuenta',
      login_success: '¡Inicio de sesión exitoso!'
    },
    errors: {
      required_fields: 'Por favor, completa todos los campos requeridos',
      first_name_required: 'El nombre es obligatorio',
      username_required: 'El ID Único es obligatorio',
      birthdate_required: 'La fecha de nacimiento es obligatoria',
      email_required: 'El correo electrónico es obligatorio',
      invalid_email: 'Por favor, ingresa un correo electrónico válido',
      password_required: 'La contraseña es obligatoria',
  password_too_short: 'La contraseña debe tener al menos 8 caracteres, incluir una letra minúscula, una letra mayúscula y al menos un carácter especial.',
      login_email_required: '¡El correo electrónico/ID Único no puede estar vacío!',
      login_password_required: '¡La contraseña es obligatoria!',
      confirm_password_required: 'Por favor, confirma tu contraseña',
      passwords_mismatch: 'Las contraseñas no coinciden',
  invalid_username: 'El ID Único debe comenzar con una letra, tener entre 3 y 20 caracteres, y solo puede contener letras, números, puntos, guiones bajos y guiones',
      username_too_short: 'El ID Único debe tener al menos 3 caracteres',
      username_unavailable: 'Por favor, elige otro ID Único',
      invalid_name_length: 'Los nombres deben tener entre 2 y 15 caracteres',
      invalid_birthdate: 'Por favor, ingresa una fecha de nacimiento válida en formato DD/MM/AAAA',
      invalid_birthdate_twentyfive: 'El año de nacimiento debe ser 1925 o posterior',
      invalid_birthdate_age: 'Lo sentimos, pero por razones de seguridad, debes tener al menos 13 años para registrarte en Florescer.',
      invalid_name: 'El nombre debe tener al menos 2 caracteres y contener solo letras',
  email_in_use_custom: 'Este correo electrónico ya está en uso. ¡Por favor, inicia sesión!',
  email_not_verified: 'Por favor, verifica tu correo electrónico antes de iniciar sesión.',
  profile_info_required: 'Se requiere la información del perfil para el registro',
  last_name_required: 'El apellido es obligatorio',
  signup_no_user: 'Registro completado pero no se creó un ID',
  no_user_found: 'ID no encontrado',
      rate_limit: 'Demasiados intentos de registro. Por favor, espera unos minutos antes de intentar nuevamente.',
      unexpected: 'Ha ocurrido un error inesperado',
      username_taken: '@{{username}} ya está en uso!',
      invalid_credentials: 'Correo electrónico/ID o contraseña inválidos'
    },
    birthdate_placeholder: 'Fecha de nacimiento'
  },
  settings: {
    theme: 'Tema',
    theme_value_dark: 'Oscuro',
    theme_value_light: 'Claro',
    language: 'Idioma',
    manage_modules: 'Administrar Módulos',
    save_changes: 'Guardar cambios',
    saving: 'Guardando...',
    modules: 'Módulos ',
    title: 'Configuración',
    loading_account: 'Cargando cuenta...',
    menu: {
      account: 'Cuenta',
      florescer_plus: 'Florescer+',
      general: 'General ',
      help: 'Ayuda'
    }
  },
  profile: {
    title: 'Perfil',
    placeholders: {
      email: 'exemplo@email.com'
    },
    dialogs: {
      enter_new_email: 'Introduce nuevo correo electrónico'
    },
    actions: {
      change_password: 'Cambiar contraseña',
      change_email: 'Cambiar correo'
    },
    buttons: {
      update_profile: 'Actualizar perfil'
    },
    success: {
      image_updated: '¡Imagen de perfil actualizada!',
      profile_updated: '¡Perfil actualizado!'
  ,reset_sent: 'Correo de restablecimiento enviado',
  email_change_requested: 'Revisa tu bandeja de entrada para confirmar el nuevo correo'
    },
    errors: {
      photo_permission: 'Se requiere permiso de la galería para elegir una imagen',
      user_not_found: 'Usuario no encontrado',
  no_email_on_account: 'No hay correo electrónico asociado a esta cuenta',
      upload_failed: 'Error al subir la imagen',
      network_error: 'Error de red al subir la imagen',
      update_failed: 'Error al actualizar el perfil',
      update_failed_generic: 'Error al actualizar tu perfil',
  failed_something: 'Algo salió mal. Por favor, inténtalo de nuevo más tarde.',
      generic_image_error: 'Ocurrió un error al procesar la imagen'
    }
  },
  auth_logout: {
    title: 'Cerrar sesión',
    message: '¿Estás seguro de que deseas cerrar sesión?',
    cancel: 'Cancelar',
    confirm: 'Cerrar sesión'
  },
  common: {
    cancel: ' Cancelar ',
    confirm: ' Confirmar '
  },
  image_cropper: {
    title: 'Seleccionar',
    camera: 'Cámara',
    gallery: 'Galería',
    remove: 'Eliminar',
    permission_title: 'Permiso necesario',
    permission_camera: 'Se requiere permiso de cámara para tomar fotos',
    permission_gallery: 'Se requiere permiso de la galería para seleccionar fotos',
    error_title: 'Error',
    error_select_failed: 'Error al seleccionar la imagen'
  },
  modules: {
  messages: 'Mensajes',
  partnership: 'Colaboración',
  delete_confirm: '¿Eliminar {{module}}?',
  delete_message: 'Eliminar el módulo {{module}} borrará permanentemente todos sus datos. Esta acción no se puede deshacer.',
  no_more_modules: 'No hay módulos activos adicionales',
    bromelia: 'Bromelia',
    pomodoro: 'Pomodoro',
    journal: 'Diario',
  addictions: 'Adicciones',
  recovery: 'Recuperación',
  focusmode: 'Foco',
  planner: 'Planificador',
  taskmanager: 'Tareas',
  habits: 'Hábitos',
  minimalapps: 'Apps Mínimos',
  applimits: 'Límites',
  moodtracker: 'Humor'
  },
  tabs: {
    home: 'Inicio',
    more: 'Más'
  },
  home: {
    day_streak: 'Racha de días',
    screen_time: 'Tiempo de pantalla hoy',
    goals_met: 'Metas alcanzadas',
    partner: 'Colega de Jornada',
    no_partner: 'Sin Colega',
    daily_checkin_title: 'Regristro de Presencia ',
    checkin_prompt: '¿Listo para comenzar tu día productivo?',
    check_in_now: 'Registrar Presencia',
    great_job: ' ¡Buen trabajo!✨ ',
    checked_in_message: 'Has registrado tu presencia hoy. ¡Estamos muy orgullosos de ti!',
    streak_maintained: 'Racha mantenida'
  },
  onboarding: {
  welcome_title: '¡Bienvenid{{o}} a Florescer!',
  welcome_subtitle: 'Vamos a empezar.',
  step1_heading: '¿Qué te trae a la app?',
  option_wellness_title: 'Bienestar',
  option_wellness_desc: 'Rutinas guiadas y ejercicios suaves para apoyar tu salud emocional, con asistencia de Bromelia.',
  option_productivity_title: 'Productividad',
  option_productivity_desc: 'Herramientas como planificador, temporizadores y listas de tareas para ayudarte a completar tareas.',
  next: 'Siguiente',
  back: 'Atrás',
  signup: 'Registrarse',
  step2_heading: 'Genial! Ahora, selecciona los módulos que deseas usar:',
  option_general_title: 'Bienestar general',
  option_general_desc: 'Hábitos, Diario, Bromelia, Diario de estado de ánimo, Aplicaciones minimalistas.',
  option_challenges_title: 'Recuperación y retos',
  option_challenges_desc: 'Herramientas de recuperación, Diario, Aplicaciones minimalistas.',
  option_productivity_secondary_title: 'Productividad general',
  option_productivity_secondary_desc: 'Modo de enfoque, Planificador, Tareas, Pomodoro.',
  modules_note: 'Puedes cambiar los módulos más tarde en Configuración.'
  ,
  change_plan: 'Cambiar plan'
  ,
  no_plan: 'Seleccionar plan',
  errors: {
    no_plan_selected: 'Por favor selecciona un plan para continuar'
  }
  },
  header: {
    good_morning: 'Buenos días',
    good_afternoon: 'Buenas tardes',
    good_evening: 'Buenas noches'
  }
  ,
  journal: {
    intro_title: 'Intenta escribir en un diario',
    intro_body: 'Escribir un diario es una práctica terapéutica sencilla que te ayuda a procesar emociones, reducir el estrés y notar patrones con el tiempo. Intenta hacer un registro rápido. Incluso unas pocas frases pueden aportar claridad y calma.',
    write_button: 'Escribir'
  }
} as const;
