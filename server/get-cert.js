import 'dotenv/config';
import tls from 'node:tls';
import { writeFileSync } from 'node:fs';

const host = process.env.EXASOL_HOST;
const port = Number(process.env.EXASOL_PORT || 8563);

if (!host) {
  throw new Error('Set EXASOL_HOST in your .env file first.');
}

const socket = tls.connect(
  { host, port, rejectUnauthorized: false },
  () => {
    const cert = socket.getPeerCertificate();

    if (!cert.raw) {
      socket.destroy();
      throw new Error('No server certificate received.');
    }

    const base64 = cert.raw.toString('base64');
    const pem = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;

    writeFileSync('server/exasol-server.pem', pem);

    console.log('Certificate SHA-256 fingerprint:');
    console.log(cert.fingerprint256);
    console.log('Saved to server/exasol-server.pem');

    socket.end();
  }
);

socket.on('error', (error) => {
  console.error('Certificate retrieval failed:', error.message);
});
