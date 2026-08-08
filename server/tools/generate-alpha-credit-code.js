require('dotenv').config({
  path:
    require('path').join(
      __dirname,
      '..',
      '.env'
    ),
});

const {
  createRechargeCode,
} = require('../utils/openai-alpha-quota');

const requestCode = process.argv[2];
const credits = Number(process.argv[3]);

if (!requestCode || !Number.isFinite(credits)) {
  console.error('');
  console.error('Utilisation :');
  console.error(
    'node server/tools/generate-alpha-credit-code.js CODE_DEMANDE NOMBRE_CREDITS'
  );
  console.error('');
  process.exit(1);
}

try {
  const code = createRechargeCode(
    requestCode,
    credits
  );

  console.log('');
  console.log('🎟️ Code de recharge :');
  console.log(code);
  console.log('');
} catch (error) {
  console.error('');
  console.error(
    '❌ Génération impossible :',
    error?.message || error
  );
  console.error('');
  process.exit(1);
}
