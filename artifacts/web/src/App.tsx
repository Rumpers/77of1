import React, { Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n";
import CookieConsentBanner from "@/components/CookieConsentBanner";

const NotFound         = React.lazy(() => import("@/pages/not-found"));
const HomePage         = React.lazy(() => import("@/pages/home"));
const FanPage          = React.lazy(() => import("@/pages/fan-page"));
const PaymentSuccessPage = React.lazy(() => import("@/pages/payment-success"));
const PaymentCancelPage  = React.lazy(() => import("@/pages/payment-cancel"));
const OnboardStep1     = React.lazy(() => import("@/pages/onboard-step1"));
const OnboardStep2     = React.lazy(() => import("@/pages/onboard-step2"));
const OnboardStep3     = React.lazy(() => import("@/pages/onboard-step3"));
const DsarPortal       = React.lazy(() => import("@/pages/dsar-portal"));
const CreatorDashboard = React.lazy(() => import("@/pages/creator-dashboard"));

const queryClient = new QueryClient();

/** Derive locale from first URL path segment, falling back to DEFAULT_LOCALE. */
function getPageLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const seg = window.location.pathname.split("/").find(Boolean) ?? "";
  return isValidLocale(seg) ? seg : DEFAULT_LOCALE;
}

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
      {/* Root → redirect to default locale */}
      <Route path="/">
        <Redirect to={`/${DEFAULT_LOCALE}`} />
      </Route>

      {/* Payment pages */}
      <Route path="/payment/success" component={PaymentSuccessPage} />
      <Route path="/payment/cancel" component={PaymentCancelPage} />

      {/* Compare view for the three landing variants */}
      <Route path="/:locale/compare">
        {() => <HomePage />}
      </Route>

      {/* Locale home page */}
      <Route path="/:locale">
        {() => <HomePage />}
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

      {/* DSAR self-service portal — §16 */}
      <Route path="/:locale/account/data-request" component={DsarPortal} />

      {/* Creator dashboard — version history, approvals, lineage */}
      <Route path="/:locale/dashboard" component={CreatorDashboard} />

      {/* Fan / creator handle page */}
      <Route path="/:locale/:handle" component={FanPage} />

      <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
        {/* Cookie consent banner — rendered outside Switch so it overlays all pages */}
        <CookieConsentBanner locale={getPageLocale()} />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
