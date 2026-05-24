import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import FanPage from "@/pages/fan-page";
import PaymentSuccessPage from "@/pages/payment-success";
import PaymentCancelPage from "@/pages/payment-cancel";
import OnboardStep3 from "@/pages/onboard-step3";
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

      {/* Creator onboarding wizard Step 3 — consent */}
      <Route path="/:locale/onboard/step3" component={OnboardStep3} />

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
