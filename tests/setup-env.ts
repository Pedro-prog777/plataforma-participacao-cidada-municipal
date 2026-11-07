// Ambiente de testes: modo demonstração (chaves de teste derivadas), sem rotina automática.
process.env.DEMO_MODE = "true";
process.env.SCHEDULER_ENABLED = "false";
process.env.STORAGE_DIR = process.env.STORAGE_DIR || "./.data/test-storage";
process.env.CPF_HMAC_KEY = process.env.CPF_HMAC_KEY || "chave-de-teste-cpf";
process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "chave-de-teste-dados";
process.env.APP_SIGNING_KEY = process.env.APP_SIGNING_KEY || "chave-de-teste-assinatura";
