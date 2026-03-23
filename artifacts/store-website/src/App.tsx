import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/Home";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminApps from "./pages/admin/Apps";
import AdminFeatured from "./pages/admin/Featured";
import AdminSubscribers from "./pages/admin/Subscribers";
import AdminGroups from "./pages/admin/Groups";
import AdminCategories from "./pages/admin/Categories";
import AdminSubCodes from "./pages/admin/SubCodes";
import AdminRequests from "./pages/admin/Requests";
import AdminPackages from "./pages/admin/Packages";
import AdminPurchases from "./pages/admin/Purchases";
import AdminNotifications from "./pages/admin/Notifications";
import AdminDownloads from "./pages/admin/Downloads";
import AdminSettings from "./pages/admin/Settings";
import AdminAddByUrl from "./pages/admin/AddByUrl";
import AdminAddByFile from "./pages/admin/AddByFile";
import AdminAdmins from "./pages/admin/AdminsList";
import AdminReviews from "./pages/admin/Reviews";
import AdminBalances from "./pages/admin/Balances";
import SubscriberProfile from "./pages/SubscriberProfile";
import Enroll from "./pages/Enroll";
import Activate from "./pages/Activate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/apps" component={AdminApps} />
      <Route path="/admin/featured" component={AdminFeatured} />
      <Route path="/admin/subscribers" component={AdminSubscribers} />
      <Route path="/admin/groups" component={AdminGroups} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/subcodes" component={AdminSubCodes} />
      <Route path="/admin/requests" component={AdminRequests} />
      <Route path="/admin/packages" component={AdminPackages} />
      <Route path="/admin/purchases" component={AdminPurchases} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/downloads" component={AdminDownloads} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/apps/add-url" component={AdminAddByUrl} />
      <Route path="/admin/apps/add-file" component={AdminAddByFile} />
      <Route path="/admin/admins" component={AdminAdmins} />
      <Route path="/admin/reviews" component={AdminReviews} />
      <Route path="/admin/balances" component={AdminBalances} />

      <Route path="/subscriber/:code" component={SubscriberProfile} />
      <Route path="/enroll" component={Enroll} />
      <Route path="/activate" component={Activate} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
