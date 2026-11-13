
/* SCAN & GET REWARD — Customer Coupon Flow */

const CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbzesiP83l5SkdKDFTEhzXlwhFNKg47Bnl8MIQP5k2uHsqsTnKdgm3rY197ReEoPPwld7g/exec",
  couponAction: "generateCoupon",
  whatsappNumber: "918112950247"
};

const $ = (id) => document.getElementById(id);

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

const form = $("couponForm");
const button = $("revealButton");
const message = $("revealMessage");
const status = $("apiStatus");

function formatExpiryDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phone = $("mobile").value.replace(/\D/g, "");

  if (!/^[6-9]\d{9}$/.test(phone)) {
    status.textContent = "PLEASE ENTER A VALID 10-DIGIT INDIAN NUMBER";
    message.textContent = "";
    return;
  }

  status.textContent = "CONNECTING TO REWARD SERVICE...";
  message.textContent = "Please wait while we check your reward.";

  button.disabled = true;
  button.textContent = "Revealing your reward...";

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: CONFIG.couponAction,
        phone
      })
    });

    if (!response.ok) {
      throw new Error("Reward service is temporarily unavailable.");
    }

    const payload = await response.json();

    if (!payload.success) {
      throw new Error(
        payload.error || "Could not generate your coupon."
      );
    }

    const coupon = payload.data;
    const discount = Number(coupon.discount);

    if (![5, 10, 15, 20].includes(discount) || !coupon.code) {
      throw new Error("Invalid coupon details received.");
    }

    const expiryDate = formatExpiryDate(coupon.expiryDate);
    const safeCode = escapeHtml(coupon.code);

    message.innerHTML = `
      <div class="result-card">

        <div class="result-label">
          ${coupon.existing
            ? "YOUR EXISTING REWARD"
            : "YOUR REWARD IS READY"}
        </div>

        <div class="result-discount">
          ${discount}% OFF
        </div>

        <div class="result-subtitle">
          YOUR EXCLUSIVE DISCOUNT COUPON
        </div>

        <div class="result-code-box">
          <div class="result-small-label">YOUR COUPON CODE</div>
          <div class="result-code" id="couponCode">${safeCode}</div>
          <button type="button" id="copyCoupon" class="result-copy">
            Copy code
          </button>
        </div>

        <div class="result-expiry">
          <div class="result-small-label">VALID UNTIL</div>
          <strong>${escapeHtml(expiryDate)}</strong>
        </div>

        <div class="result-note">
          ${coupon.existing
            ? "Your previously issued coupon is shown above."
            : "Your reward has been successfully created."}
        </div>

        <a
          class="result-whatsapp"
          id="shareCoupon"
          href="#"
          target="_blank"
          rel="noopener"
        >
          Share on WhatsApp ↗
        </a>

      </div>
    `;

    const copyButton = $("copyCoupon");

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(coupon.code);
        copyButton.textContent = "Copied ✓";
      } catch (error) {
        const codeElement = $("couponCode");
        const selection = window.getSelection();
        const range = document.createRange();

        range.selectNodeContents(codeElement);
        selection.removeAllRanges();
        selection.addRange(range);

        copyButton.textContent = "Select and copy the code";
      }
    });

    const shareText =
      `My Scan & Get Reward coupon is ${coupon.code}. ` +
      `I received ${discount}% OFF! ` +
      `Valid until: ${expiryDate}.`;

    $("shareCoupon").href =
      `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(shareText)}`;

    status.textContent = coupon.existing
      ? "EXISTING REWARD FOUND"
      : "YOUR REWARD IS READY";

  } catch (error) {
    status.textContent = "REWARD SERVICE ERROR";
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Reveal my reward ↗";
  }
});
