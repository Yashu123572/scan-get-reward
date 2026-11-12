
/* SCAN & GET REWARD — customer coupon flow */
const CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbzesiP83l5SkdKDFTEhzXlwhFNKg47Bnl8MIQP5k2uHsqsTnKdgm3rY197ReEoPPwld7g/exec",
  couponAction: "generateCoupon",
  whatsappNumber: "918112950247"
};

const $ = (id) => document.getElementById(id);
const menuToggle = $("menuToggle"), mainNav = $("mainNav");

menuToggle?.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

mainNav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  mainNav.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
}));

if ($("year")) $("year").textContent = new Date().getFullYear();

const form = $("couponForm");
const button = $("revealButton");
const message = $("revealMessage");
const status = $("apiStatus");

// Format coupon expiry date for customers
function formatExpiryDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phone = $("mobile").value.replace(/\D/g, "");

  if (!/^[6-9]\d{9}$/.test(phone)) {
    status.textContent = "PLEASE ENTER A VALID 10-DIGIT INDIAN NUMBER";
    return;
  }

  status.textContent = "CONNECTING TO REWARD SERVICE…";
  message.textContent = "Please wait while we check your reward.";
  button.disabled = true;
  button.textContent = "Please wait…";

  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: CONFIG.couponAction,
        phone
      })
    });

    const payload = await response.json();

    if (!payload.success) {
      throw new Error(payload.error || "Coupon service could not complete the request.");
    }

    const coupon = payload.data;
    const discount = Number(coupon.discount);

    if (![5, 10, 15, 20].includes(discount) || !coupon.code) {
      throw new Error("The reward service returned an unexpected coupon response.");
    }

    const expiryDate = formatExpiryDate(coupon.expiryDate);

    message.innerHTML = `
      <div class="coupon-result" style="margin-top:16px;padding:18px;border:1px solid #c9aa69;background:#17140e;text-align:center">

        <div style="font-size:10px;letter-spacing:2px;color:#c9aa69">
          YOUR EXCLUSIVE REWARD
        </div>

        <div style="font-size:clamp(42px,8vw,64px);font-weight:800;color:#e3c47f;margin:8px 0">
          ${discount}% OFF
        </div>

        <div style="font-size:11px;color:#c9c1af">
          YOUR COUPON CODE
        </div>

        <div id="couponCode" style="font-size:20px;letter-spacing:2px;color:#fff;margin:8px 0">
          ${escapeHtml(coupon.code)}
        </div>

        <div style="margin:16px auto;padding:12px;border:1px dashed #c9aa69;border-radius:8px;max-width:280px">
          <div style="font-size:10px;letter-spacing:1px;color:#c9c1af">
            VALID UNTIL
          </div>
          <div style="font-size:17px;font-weight:700;color:#e3c47f;margin-top:5px">
            ${escapeHtml(expiryDate)}
          </div>
        </div>

        <button type="button" id="copyCoupon" class="button button-gold" style="margin-top:8px">
          Copy coupon code
        </button>

        <div style="font-size:10px;color:#aaa;margin-top:12px">
          ${coupon.existing
            ? "Your previously issued coupon is shown above."
            : "Your reward has been created."}
        </div>

      </div>`;

    $("copyCoupon").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(coupon.code);
        $("copyCoupon").textContent = "Copied!";
      } catch (_) {
        $("copyCoupon").textContent = "Please select and copy the code";
      }
    });

    if (CONFIG.whatsappNumber) {
      const text =
        `Hello! My mobile number is ${phone}. ` +
        `My coupon code is ${coupon.code}, ` +
        `my discount is ${discount}% OFF. ` +
        `Valid Until: ${expiryDate}.`;

      const wa = document.createElement("a");

      wa.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.textContent = "Share coupon on WhatsApp";
      wa.className = "button button-outline";
      wa.style.cssText = "display:block;text-align:center;margin-top:12px;padding:14px";

      message.appendChild(wa);
    }

    status.textContent = coupon.existing
      ? "EXISTING REWARD FOUND"
      : "YOUR REWARD IS READY";

  } catch (error) {
    status.textContent = "REWARD SERVICE COULD NOT BE REACHED";
    message.textContent = error.message +
      " If this page is opened as a local file, publish it on HTTPS hosting and test again.";
  } finally {
    button.disabled = false;
    button.innerHTML = 'Continue securely <span>↗</span>';
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
