import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import FanPage from "@/pages/fan-page";
import PaymentSuccessPage from "@/pages/payment-success";
import PaymentCancelPage from "@/pages/payment-cancel";
import OnboardStep1 from "@/pages/onboard-step1";
import OnboardStep2 from "@/pages/onboard-step2";
import OnboardStep3 from "@/pages/onboard-step3";
import FanRecover from "@/pages/fan-recover";
import FanDsar from "@/pages/fan-dsar";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Root → redirect to default locale */}
      <Route path="/">
        <Redirect to={`/${DEFAULT_LOCALE}`} />
      </Route>

      {/* Payment pages */}
      <Route path="/payment/success" component={PaymentSuccessPage} />
      <Route path="/payment/cancel" component={PaymentCancelPage} />

      {/* Locale home page */}
      <Route path="/:locale">
        {(params) => <HomePage />}
      </Route>

      {/* Creator onboarding wizard — deep link dispatcher */}
      <Route path="/:locale/onboard">
        {(params) => {
          const search = typeof window !== "undefined" ? window.location.search : "";
          const sp = new URLSearchParams(search);
          const step = sp.get("step") ?? "1";
          const locale = params.locale ?? DEFAULT_LOCALE;
          return <Redirect to={`/${locale}/onboard/step${step}`} />;
        }}
      </Route>

      {/* Creator onboarding wizard steps */}
      <Route path="/:locale/onboard/step1" component={OnboardStep1} />
      <Route path="/:locale/onboard/step2" component={OnboardStep2} />
      <Route path="/:locale/onboard/step3" component={OnboardStep3} />

      {/* Fan account recovery */}
      <Route path="/:locale/recover" component={FanRecover} />

      {/* DSAR self-service — fan data download + creator export (§16) */}
      <Route path="/:locale/dsar" component={FanDsar} />

      {/* Fan / creator handle page */}
      <Route path="/:locale/:handle" component={FanPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
