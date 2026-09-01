function emv(id, value) {
  const text = String(value ?? "");
  return `${id}${String(text.length).padStart(2, "0")}${text}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function asciiPix(value, max) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export const PIX_KEY_TYPES = [
  { id: "cpf", label: "CPF" },
  { id: "cnpj", label: "CNPJ" },
  { id: "email", label: "E-mail" },
  { id: "phone", label: "Celular" },
  { id: "evp", label: "Chave aleatória" },
];

export function sanitizePixKey(type, raw) {
  const value = String(raw || "").trim();
  if (type === "cpf" || type === "cnpj") return value.replace(/\D/g, "");
  if (type === "email") return value.toLowerCase();
  if (type === "phone") {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("55")) digits = digits.slice(2);
    if (digits.length < 10) return digits;
    return `+55${digits}`;
  }
  return value.replace(/\s/g, "").toLowerCase();
}

export function pixKeyError(type, key) {
  if (!key) return "Informe a chave PIX.";
  if (type === "cpf" && key.length !== 11) return "CPF precisa ter 11 dígitos.";
  if (type === "cnpj" && key.length !== 14) return "CNPJ precisa ter 14 dígitos.";
  if (type === "email" && (!key.includes("@") || !key.includes("."))) {
    return "Informe um e-mail válido.";
  }
  if (type === "phone" && !/^\+55\d{10,11}$/.test(key)) {
    return "Informe um celular com DDD.";
  }
  if (type === "evp" && key.length < 32) return "Informe a chave aleatória completa.";
  return "";
}

export function buildPixPayload({ key, name, city, amount, description }) {
  const pixKey = String(key || "").trim();
  if (!pixKey) return "";
  const merchant = asciiPix(name, 25) || "MOTORISTA";
  const merchantCity = asciiPix(city, 15) || "SAO PAULO";
  let gui = emv("00", "BR.GOV.BCB.PIX") + emv("01", pixKey);
  const note = asciiPix(description, 50);
  if (note) gui += emv("02", note);
  let payload = emv("00", "01");
  payload += emv("26", gui);
  payload += emv("52", "0000");
  payload += emv("53", "986");
  const value = Number(amount);
  if (Number.isFinite(value) && value > 0) {
    payload += emv("54", value.toFixed(2));
  }
  payload += emv("58", "BR");
  payload += emv("59", merchant);
  payload += emv("60", merchantCity);
  payload += emv("62", emv("05", "***"));
  payload += "6304";
  return payload + crc16(payload);
}
