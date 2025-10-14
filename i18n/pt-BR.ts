export default {
  auth: {
    language: {
      en: 'English',
      pt: 'Português'
    },
    loading: 'Carregando...',
    welcome_new: 'Boas-vindas!',
    welcome_back: 'Boas-vindas outra vez!',
    fields: {
      name: 'Nome',
      last_name: 'Sobrenome (Opc.)',
      birthdate: 'Data de Nascimento',
      email: 'E-mail',
      username: 'ID Único',
      email_or_username: 'E-mail/ID Único',
      password: 'Senha',
      confirm_password: 'Confirmar senha'
    },
    buttons: {
      signup: 'Cadastre-se',
      login: 'Entrar'
    },
    links: {
      have_account: 'Já tem uma conta? ',
      no_account: 'Não tem uma conta ainda? '
    },
    status: {
      loading: 'Carregando...',
      checking_username: 'Verificando ID Único...'
    },
    success: {
      check_email: 'Por favor, verifique seu e-mail para confirmar sua conta.',
      verify_account: 'Por favor, verifique sua conta',
      login_success: 'Login realizado com sucesso!'
    },
    errors: {
      required_fields: 'Por favor, preencha todos os campos obrigatórios',
      first_name_required: 'O nome é obrigatório',
      username_required: 'O ID Único é obrigatório',
      birthdate_required: 'A data de nascimento é obrigatória',
      email_required: 'O e-mail é obrigatório',
      invalid_email: 'Por favor, insira um endereço de e-mail válido',
      password_required: 'A senha é obrigatória',
  password_too_short: 'A senha deve ter pelo menos 8 caracteres, incluir uma letra minúscula, uma letra maiúscula e pelo menos um caractere especial.',
      confirm_password_required: 'Por favor, confirme sua senha',
      passwords_mismatch: 'As senhas não coincidem',
  invalid_username: 'O ID deve começar com uma letra, ter entre 3 e 20 caracteres, e só pode conter letras, números, pontos, sublinhados e hífens',
      username_too_short: 'O ID deve ter pelo menos 3 caracteres',
      username_unavailable: 'Por favor, escolha um ID diferente',
      invalid_name_length: 'Os nomes devem ter entre 2 e 15 caracteres',
      invalid_birthdate: 'Por favor, insira uma data de nascimento válida no formato DD/MM/AAAA',
      invalid_birthdate_twentyfive: 'O ano de nascimento deve ser 1925 ou posterior',
      invalid_birthdate_age: 'Lamentamos, mas por razões de segurança, você precisa ter pelo menos 13 anos para se cadastrar no Florescer.',
      invalid_name: 'O nome deve ter pelo menos 2 caracteres e conter apenas letras',
    email_in_use_custom: 'Este e-mail já está em uso. Por favor, faça login!',
    email_not_verified: 'Por favor, verifique seu e-mail antes de efetuar o login.',
  profile_info_required: 'Informações do perfil são necessárias para cadastro',
  last_name_required: 'O sobrenome é obrigatório',
  signup_no_user: 'Cadastro concluído, mas nenhum ID foi criado',
  no_user_found: 'Nenhum ID encontrado',
      rate_limit: 'Muitas tentativas de cadastro. Por favor, aguarde alguns minutos antes de tentar novamente.',
      unexpected: 'Ocorreu um erro inesperado',
      username_taken: '@{{username}} já está em uso',
      invalid_credentials: 'E-mail/ID ou senha inválidos',
      login_email_required: 'O e-mail/ID Único não pode estar vazio!',
      login_password_required: 'A senha é obrigatória!'
    },
    birthdate_placeholder: 'Data de Nascimento'
  },
  settings: {
    theme: 'Tema',
    theme_value_dark: 'Escuro',
    theme_value_light: 'Claro',
    language: 'Idioma',
    manage_modules: 'Gerenciar Módulos',
    save_changes: 'Salvar alterações',
    saving: 'Salvando...',
    modules: 'Módulos ',
    title: 'Configurações',
    loading_account: 'Carregando conta...',
    menu: {
      account: 'Conta',
      florescer_plus: 'Florescer+',
      general: 'Geral ',
      help: 'Ajuda'
    },
  },
  profile: {
    title: 'Perfil',
    placeholders: {
      email: 'exemplo@email.com'
    },
    actions: {
      change_password: 'Alterar senha',
      change_email: 'Alterar e-mail'
    },
    buttons: {
      update_profile: 'Atualizar perfil'
    },
    success: {
      image_updated: 'Imagem de perfil atualizada!',
      profile_updated: 'Perfil atualizado!'
  ,reset_sent: 'E-mail de redefinição enviado',
  email_change_requested: 'Verifique sua caixa de entrada para confirmar o novo e-mail'
    },
    errors: {
      photo_permission: 'Permissão da galeria é necessária para escolher uma imagem',
      user_not_found: 'Usuário não encontrado',
  no_email_on_account: 'Nenhum e-mail associado a esta conta',
      upload_failed: 'Falha ao enviar a imagem',
      network_error: 'Erro de rede ao enviar a imagem',
      update_failed: 'Falha ao atualizar o perfil',
      update_failed_generic: 'Falha ao atualizar seu perfil',
  failed_something: 'Algo deu errado. Por favor, tente novamente mais tarde.',
      generic_image_error: 'Ocorreu um erro ao processar a imagem'
    }
    ,
    dialogs: {
      enter_new_email: 'Insira novo e-mail'
    }
  },
  auth_logout: {
    title: 'Sair',
    message: 'Tem certeza de que deseja sair?',
    cancel: 'Cancelar',
    confirm: 'Sair'
  },
  common: {
    cancel: ' Cancelar ',
    confirm: ' Confirmar '
  },
  image_cropper: {
    title: 'Selecionar',
    camera: 'Câmera',
    gallery: 'Galeria',
    remove: 'Remover',
    permission_title: 'Permissão necessária',
    permission_camera: 'Permissão da câmera é necessária para tirar fotos',
    permission_gallery: 'Permissão da galeria é necessária para selecionar fotos',
    error_title: 'Erro',
    error_select_failed: 'Falha ao selecionar imagem'
  },
  modules: {
  messages: 'Mensagens',
  partnership: 'Parceria',
  delete_confirm: 'Remover {{module}}?',
  delete_message: 'Remover o módulo {{module}} excluirá permanentemente todos os dados associados. Esta ação não pode ser desfeita.',
  no_more_modules: 'Não há módulos ativos adicionais',
    bromelia: 'Bromélia',
    pomodoro: 'Pomodoro',
    journal: 'Diário',
  addictions: 'Vícios',
  recovery: 'Recuperação',
  focusmode: 'Foco',
  planner: 'Planejador',
  taskmanager: 'Tarefas',
  habits: 'Hábitos',
  minimalapps: 'Apps Mínimos',
  applimits: 'Limites',
  moodtracker: 'Humor'
  },
  tabs: {
    home: 'Início',
    more: 'Mais'
  },
  home: {
    day_streak: 'Sequência de dias',
    screen_time: 'Tempo de tela hoje',
    goals_met: 'Metas atingidas',
    partner: 'Colega de Jornada',
    no_partner: 'Sem Colega',
  // create_account: 'Quer criar outra conta?', // Removed for translation cleanup
    daily_checkin_title: 'Registro de Presença ',
    checkin_prompt: 'Pronto para começar seu dia?',
    check_in_now: 'Marcar Presença',
    great_job: ' Bom trabalho!✨ ',
    checked_in_message: 'Você marcou presença hoje. Estamos muito orgulhosos de você!',
    streak_maintained: 'Sequência mantida'
  },
  onboarding: {
  welcome_title: 'Boas-vindas ao Florescer!',
  welcome_subtitle: 'Vamos começar.',
  step1_heading: 'O que te traz ao app?',
  option_wellness_title: 'Bem-estar',
  option_wellness_desc: 'Rotinas guiadas e exercícios suaves para apoiar sua saúde emocional, com assistência da Bromélia.',
  option_productivity_title: 'Produtividade',
  option_productivity_desc: 'Ferramentas como planejador, temporizadores e listas de tarefas para ajudar você a realizar tarefas.',
  next: 'Próximo',
  back: 'Voltar',
  signup: 'Cadastrar',
  step2_heading: 'Ótimo! agora selecione os módulos que deseja:',
  option_general_title: 'Bem-estar geral',
  option_general_desc: 'Hábitos, Diário, Bromélia, Diário de Humor, Aplicativos minimalistas.',
  option_challenges_title: 'Recuperação e Desafios',
  option_challenges_desc: 'Ferramentas de recuperação, Diário, Aplicativos minimalistas.',
  option_productivity_secondary_title: 'Produtividade geral',
  option_productivity_secondary_desc: 'Modo de Foco, Planejador, Tarefas, Pomodoro.',
  modules_note: 'Você pode alterar os módulos mais tarde nas Configurações.'
  ,
    no_plan: 'Selecionar plano',
    errors: {
      no_plan_selected: 'Por favor, selecione um plano para continuar'
    }
  },
  header: {
    good_morning: 'Bom dia',
    good_afternoon: 'Boa tarde',
    good_evening: 'Boa noite'
  }
  ,
  journal: {
    intro_title: 'Experimente escrever um diário',
    intro_body: 'Escrever um diário é uma prática terapêutica simples que ajuda a processar emoções, reduzir o estresse e perceber padrões ao longo do tempo. Tente fazer um registro rápido. Mesmo algumas frases podem trazer clareza e calma.',
    write_button: 'Escrever',
    delete_confirm: 'Excluir este registro?',
    delete_entry_message: 'Este registro será excluído permanentemente e não poderá ser recuperado.'
  }
  ,
  entry: {
    edit: 'Editar Registro',
    title: 'Título',
    enter_title: 'Insira o título...',
    content: 'Conteúdo',
    start_writing: 'Comece a escrever seu registro...',
    save: 'Salvar'
  ,
  new: 'Novo Registro de Diário',
    entry_title: 'Título do Registro',
  date_placeholder: 'DD/MM/YYYY',
  invalid_date: 'Formato de data inválido',
  create: 'Criar registro'
  }
} as const;
