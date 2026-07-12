import Stripe from "stripe";

// Единый экземпляр Stripe SDK для всех серверных route handler'ов.
// STRIPE_SECRET_KEY не имеет префикса NEXT_PUBLIC_ — значит недоступен в
// браузере, что и требуется: секретный ключ Stripe даёт полный доступ к
// созданию платежей/подписок от имени аккаунта.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Фиксируем версию API явно. Если её не указать, Stripe использует
  // версию, привязанную к моменту создания аккаунта — при обновлении
  // библиотеки stripe-node поведение может незаметно измениться.
  apiVersion: "2024-10-28.acacia",
  typescript: true,
  appInfo: {
    name: "Flowora",
    version: "1.0.0",
  },
});
