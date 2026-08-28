export function blockInvalidNumberKey(event) {
  if (["-", "e", "E", "+"].includes(event.key)) {
    event.preventDefault();
  }
}

export function sanitizeNumberInput(value) {
  return String(value ?? "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
}

export function parseAmount(value, { required = false, min = 0, max = 9_999_999, label = "valor" } = {}) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (raw === "") {
    if (required) return { ok: false, error: `Informe o ${label}.` };
    return { ok: true, value: 0 };
  }
  const number = Number(raw);
  if (!Number.isFinite(number)) {
    return { ok: false, error: `${label} inválido.` };
  }
  if (number < min) {
    if (min > 0) return { ok: false, error: `Informe um ${label} maior que zero.` };
    return { ok: false, error: `O ${label} não pode ser negativo.` };
  }
  if (number > max) {
    return { ok: false, error: `${label} alto demais.` };
  }
  return { ok: true, value: number };
}

export function parseOptionalAmount(value, options = {}) {
  if (String(value ?? "").trim() === "") {
    return { ok: true, value: null };
  }
  return parseAmount(value, options);
}

export const moneyFieldProps = {
  type: "number",
  min: "0",
  step: "0.01",
  inputMode: "decimal",
  onKeyDown: blockInvalidNumberKey,
  onWheel: (event) => event.currentTarget.blur(),
};

export const kmFieldProps = {
  type: "number",
  min: "0",
  step: "0.1",
  inputMode: "decimal",
  onKeyDown: blockInvalidNumberKey,
  onWheel: (event) => event.currentTarget.blur(),
};

export const hoursFieldProps = {
  type: "number",
  min: "0",
  step: "0.5",
  inputMode: "decimal",
  onKeyDown: blockInvalidNumberKey,
  onWheel: (event) => event.currentTarget.blur(),
};

export const intFieldProps = {
  type: "number",
  min: "0",
  step: "1",
  inputMode: "numeric",
  onKeyDown: blockInvalidNumberKey,
  onWheel: (event) => event.currentTarget.blur(),
};
