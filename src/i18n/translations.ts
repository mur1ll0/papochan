export type Locale = 'pt-BR' | 'en';

export const translations = {
  'pt-BR': {
    // Brand & Tagline
    'app.name': 'PapoChan',
    'app.tagline': 'Comunicação direta, telas simultâneas e privacidade total',
    'app.badge.e2ee': 'Protegido com Criptografia de Ponta a Ponta',
    'app.badge.directCalls': 'Chamadas Diretas Ativas',

    // Main Actions
    'home.hero.title': 'Conecte suas telas e',
    'home.hero.titleHighlight': 'puxe um papo',
    'home.hero.subtitle': 'Transmita sua tela em 60 FPS no computador e use a câmera no celular ao mesmo tempo. Sem senhas complexas, 100% privado.',
    'home.tab.rooms': 'Salas Instantâneas',
    'home.tab.contacts': 'Dispositivos Salvos (Contatos)',
    'home.btn.createRoom': 'Criar Sala Instantânea',
    'home.btn.creatingRoom': 'Criando Canal...',
    'home.input.roomCode': 'CÓDIGO DA SALA',
    'home.btn.join': 'Entrar na Sala',
    'home.feature.coPresence.title': 'Multi-Dispositivo em Tempo Real:',
    'home.feature.coPresence.desc': 'Entre na mesma sala pelo celular (câmera/voz) e pelo PC (tela 60 FPS com áudio) simultaneamente.',

    // Device Vault / Profile
    'vault.title': 'Meu Dispositivo',
    'vault.badge.local': 'Hardware Local',
    'vault.username.label': 'SEU NOME / APELIDO',
    'vault.deviceName.label': 'NOME DESTE APARELHO',
    'vault.btn.edit': 'Renomear',
    'vault.btn.save': 'Salvar',
    'vault.btn.cancel': 'Cancelar',
    'vault.devicePlaceholder': 'Ex: Meu PC, Celular do Murillo',
    'vault.userPlaceholder': 'Ex: Murillo',
    'vault.status.secured': 'Canal Criptografado Ativo',

    // Contacts & Calling
    'contacts.title': 'Dispositivos e Amigos Salvos',
    'contacts.search': 'Buscar contato ou dispositivo...',
    'contacts.empty': 'Nenhum dispositivo salvo ainda.',
    'contacts.emptyHelp': 'Quando você estiver em uma chamada, clique no botão "Salvar Contato" para salvar este dispositivo aqui.',
    'contacts.btn.call': 'Ligar Agora',
    'contacts.btn.calling': 'Chamando...',
    'contacts.btn.editAlias': 'Editar Apelido',
    'contacts.btn.delete': 'Remover',
    'contacts.confirmDelete': 'Tem certeza que deseja remover este contato?',
    'contacts.lastCalled': 'Última chamada:',
    'contacts.neverCalled': 'Nunca chamado',

    // Call Screen / Controls
    'call.control.mic.mute': 'Mutar Microfone',
    'call.control.mic.unmute': 'Desmutar Microfone',
    'call.control.cam.on': 'Ligar Câmera',
    'call.control.cam.off': 'Desligar Câmera',
    'call.control.screen.share': 'Compartilhar Tela',
    'call.control.screen.stop': 'Parar Compartilhamento',
    'call.control.screenAudio.mute': 'Mutar Áudio da Tela',
    'call.control.screenAudio.unmute': 'Desmutar Áudio da Tela',
    'call.control.screen.popover.title': 'Transmitir Tela (60 FPS)',
    'call.control.screen.popover.subtitle': 'Escolha como deseja transmitir sua tela, janela ou aba:',
    'call.control.screen.withAudio.title': 'Com Áudio do Sistema (Recomendado)',
    'call.control.screen.withAudio.desc': 'Transmite vídeo + som de abas, YouTube, vídeos e jogos.',
    'call.control.screen.videoOnly.title': 'Apenas Vídeo (Sem Som)',
    'call.control.screen.videoOnly.desc': 'Transmite apenas a imagem visual da tela.',
    'call.control.screen.cancel': 'Cancelar',
    'call.control.security': 'Segurança E2EE',
    'call.control.settings': 'Configurações de Áudio e Vídeo',
    'call.control.chat': 'Chat da Sala',
    'call.control.leave': 'Sair da Chamada',

    // Modals / Ringing
    'call.incoming.title': 'Chamada Recebida',
    'call.incoming.callingYou': 'está te chamando para um PapoChan...',
    'call.incoming.accept': 'Atender Chamada',
    'call.incoming.reject': 'Recusar',
    'call.outgoing.title': 'Chamando...',
    'call.outgoing.ringing': 'Aguardando atendimento de',
    'call.outgoing.cancel': 'Cancelar Chamada',
    'call.outgoing.rejected': 'Chamada Recusada',
    'call.outgoing.noAnswer': 'Sem Resposta',

    // Settings & Noise Suppression
    'settings.title': 'Configurações de Áudio e Vídeo',
    'settings.noiseSuppression': 'Supressão de Ruído por IA',
    'settings.noise.off': 'Desativado',
    'settings.noise.standard': 'Padrão',
    'settings.noise.ai': 'IA Neural',
    'settings.mic': 'Microfone',
    'settings.cam': 'Câmera',
    'settings.output': 'Saída de Áudio (Alto-falante)',
    'settings.language': 'Idioma / Language',

    // Chat
    'chat.title': 'Chat da Sala',
    'chat.placeholder': 'Digite uma mensagem segura...',
    'chat.send': 'Enviar',
    'chat.empty': 'Nenhuma mensagem ainda. O chat é volátil e não fica salvo.',
    'chat.sendFile': 'Enviar Arquivo',
    'chat.typing': 'está digitando...',

    // Room Header & Status
    'room.header.roomCode': 'Sala:',
    'room.header.copyLink': 'Copiar Link',
    'room.header.copied': 'Copiado!',
    'room.header.sisterDevice': 'Dispositivo Irmão Conectado',

    // Common
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.close': 'Fechar',
    'common.loading': 'Carregando...',
    'common.error': 'Ocorreu um erro',
  },
  'en': {
    // Brand & Tagline
    'app.name': 'PapoChan',
    'app.tagline': 'Direct calls, simultaneous screens, and complete privacy',
    'app.badge.e2ee': 'Protected with End-to-End Encryption',
    'app.badge.directCalls': 'Direct P2P Calls Active',

    // Main Actions
    'home.hero.title': 'Connect your screens and',
    'home.hero.titleHighlight': 'start a chat',
    'home.hero.subtitle': 'Stream your 60 FPS desktop screen and use your mobile camera at the same time. No complex passwords, 100% private.',
    'home.tab.rooms': 'Instant Rooms',
    'home.tab.contacts': 'Saved Devices (Contacts)',
    'home.btn.createRoom': 'Create Instant Room',
    'home.btn.creatingRoom': 'Creating Channel...',
    'home.input.roomCode': 'ROOM CODE',
    'home.btn.join': 'Join Room',
    'home.feature.coPresence.title': 'Real-time Multi-Device:',
    'home.feature.coPresence.desc': 'Join the same room on your phone (camera/mic) and your laptop (60 FPS screen with audio) simultaneously.',

    // Device Vault / Profile
    'vault.title': 'My Device',
    'vault.badge.local': 'Local Hardware',
    'vault.username.label': 'YOUR NAME / ALIAS',
    'vault.deviceName.label': 'DEVICE NAME',
    'vault.btn.edit': 'Rename',
    'vault.btn.save': 'Save',
    'vault.btn.cancel': 'Cancel',
    'vault.devicePlaceholder': 'e.g. My Laptop, Murillo\'s Phone',
    'vault.userPlaceholder': 'e.g. Murillo',
    'vault.status.secured': 'Encrypted Channel Active',

    // Contacts & Calling
    'contacts.title': 'Saved Devices and Friends',
    'contacts.search': 'Search contact or device...',
    'contacts.empty': 'No saved devices yet.',
    'contacts.emptyHelp': 'When you are in a call, click the "Save Contact" button to save this device here.',
    'contacts.btn.call': 'Call Now',
    'contacts.btn.calling': 'Calling...',
    'contacts.btn.editAlias': 'Edit Alias',
    'contacts.btn.delete': 'Remove',
    'contacts.confirmDelete': 'Are you sure you want to remove this contact?',
    'contacts.lastCalled': 'Last called:',
    'contacts.neverCalled': 'Never called',

    // Call Screen / Controls
    'call.control.mic.mute': 'Mute Microphone',
    'call.control.mic.unmute': 'Unmute Microphone',
    'call.control.cam.on': 'Turn Camera On',
    'call.control.cam.off': 'Turn Camera Off',
    'call.control.screen.share': 'Share Screen',
    'call.control.screen.stop': 'Stop Sharing',
    'call.control.screenAudio.mute': 'Mute Screen Audio',
    'call.control.screenAudio.unmute': 'Unmute Screen Audio',
    'call.control.screen.popover.title': 'Share Screen (60 FPS)',
    'call.control.screen.popover.subtitle': 'Choose how you want to share your screen, window, or tab:',
    'call.control.screen.withAudio.title': 'With System Audio (Recommended)',
    'call.control.screen.withAudio.desc': 'Streams video + audio from tabs, YouTube, videos, and games.',
    'call.control.screen.videoOnly.title': 'Video Only (No Audio)',
    'call.control.screen.videoOnly.desc': 'Shares only the visual display of the screen.',
    'call.control.screen.cancel': 'Cancel',
    'call.control.security': 'E2EE Security',
    'call.control.settings': 'Audio & Video Settings',
    'call.control.chat': 'Room Chat',
    'call.control.leave': 'Leave Call',

    // Modals / Ringing
    'call.incoming.title': 'Incoming Call',
    'call.incoming.callingYou': 'is calling you on PapoChan...',
    'call.incoming.accept': 'Accept Call',
    'call.incoming.reject': 'Decline',
    'call.outgoing.title': 'Calling...',
    'call.outgoing.ringing': 'Waiting for answer from',
    'call.outgoing.cancel': 'Cancel Call',
    'call.outgoing.rejected': 'Call Declined',
    'call.outgoing.noAnswer': 'No Answer',

    // Settings & Noise Suppression
    'settings.title': 'Audio & Video Settings',
    'settings.noiseSuppression': 'AI Noise Suppression',
    'settings.noise.off': 'Off',
    'settings.noise.standard': 'Standard',
    'settings.noise.ai': 'Neural AI',
    'settings.mic': 'Microphone',
    'settings.cam': 'Camera',
    'settings.output': 'Audio Output (Speaker)',
    'settings.language': 'Language / Idioma',

    // Chat
    'chat.title': 'Room Chat',
    'chat.placeholder': 'Type a secure message...',
    'chat.send': 'Send',
    'chat.empty': 'No messages yet. Chat is in-memory and never saved to a server.',
    'chat.sendFile': 'Send File',
    'chat.typing': 'is typing...',

    // Room Header & Status
    'room.header.roomCode': 'Room:',
    'room.header.copyLink': 'Copy Link',
    'room.header.copied': 'Copied!',
    'room.header.sisterDevice': 'Sister Device Connected',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
  },
} as const;

export type TranslationKey = keyof typeof translations['pt-BR'];
