import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function PixQr({ payload, title }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!payload) {
      setSrc("");
      return;
    }
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#042f1c", light: "#ffffff" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [payload]);

  if (!payload) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      {title ? <p className="text-sm font-semibold text-emerald-100/80">{title}</p> : null}
      {src ? (
        <img
          src={src}
          alt="QR Code PIX"
          className="h-56 w-56 rounded-2xl bg-white p-2"
        />
      ) : (
        <p className="text-sm text-emerald-100/60">Gerando QR Code...</p>
      )}
    </div>
  );
}
