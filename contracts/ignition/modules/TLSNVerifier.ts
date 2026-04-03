import { buildModule } from "@nomicfoundation/ignition/modules";

const ADMIN_ADDRESSES = [
  "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3", // Admin1
  "0x1b7a22C21745ab854c0B55528B085718864d8f11", // Admin2
  "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7", // Admin3
];

export default buildModule("TLSNContentVerifierWithMultisig", (m) => {
  const contract = m.contract("TLSNContentVerifierWithMultisig", [ADMIN_ADDRESSES]);

  return { contract };
});