// Diagnóstico: muestra los dispositivos expuestos por el servidor OPC UA de CODESYS.
// Uso: npm run browse
import 'dotenv/config';
import { OPCUAClient, MessageSecurityMode, SecurityPolicy, UserTokenType } from 'node-opcua';

const endpoint = process.env.OPCUA_ENDPOINT || 'opc.tcp://localhost:4840';
const client = OPCUAClient.create({
  securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None,
  endpointMustExist: false, connectionStrategy: { maxRetry: 0 },
});

try {
  await client.connect(endpoint);
  const identity = process.env.OPCUA_USER
    ? { type: UserTokenType.UserName, userName: process.env.OPCUA_USER, password: process.env.OPCUA_PASSWORD ?? '' }
    : { type: UserTokenType.Anonymous };
  const session = await client.createSession(identity);
  console.log('Namespaces:');
  (await session.readNamespaceArray()).forEach((ns, i) => console.log(`  ns=${i}  ${ns}`));

  const objects = await session.browse('ObjectsFolder');
  const deviceSet = objects.references.find((r) => r.browseName.name === 'DeviceSet');
  if (deviceSet) {
    const devices = await session.browse(deviceSet.nodeId);
    console.log('\nDispositivos (usa uno como OPCUA_DEVICE en .env):');
    devices.references.forEach((r) => console.log(`  - ${r.browseName.name}`));
  } else {
    console.log('\nNo se encontró DeviceSet. Revisa la Symbol Configuration en CODESYS.');
  }
  await session.close();
} catch (err) {
  console.error(`No se pudo conectar a ${endpoint}: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.disconnect();
}
