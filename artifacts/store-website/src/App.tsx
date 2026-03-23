import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
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

function AdminRoute({ component: Component }: { component: () => JSX.Element }) {
  const token = localStorage.getItem("adminToken");
  if (!token) return <Redirect to="/admin/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">{() => <AdminRoute component={AdminDashboard} />}</Route>
      <Route path="/admin/apps/add-url">{() => <AdminRoute component={AdminAddByUrl} />}</Route>
      <Route path="/admin/apps/add-file">{() => <AdminRoute component={AdminAddByFile} />}</Route>
      <Route path="/admin/apps">{() => <AdminRoute component={AdminApps} />}</Route>
      <Route path="/admin/featured">{() => <AdminRoute component={AdminFeatured} />}</Route>
      <Route path="/admin/subscribers">{() => <AdminRoute component={AdminSubscribers} />}</Route>
      <Route path="/admin/groups">{() => <AdminRoute component={AdminGroups} />}</Route>
      <Route path="/admin/categories">{() => <AdminRoute component={AdminCategories} />}</Route>
      <Route path="/admin/subcodes">{() => <AdminRoute component={AdminSubCodes} />}</Route>
      <Route path="/admin/requests">{() => <AdminRoute component={AdminRequests} />}</Route>
      <Route path="/admin/packages">{() => <AdminRoute component={AdminPackages} />}</Route>
      <Route path="/admin/purchases">{() => <AdminRoute component={AdminPurchases} />}</Route>
      <Route path="/admin/notifications">{() => <AdminRoute component={AdminNotifications} />}</Route>
      <Route path="/admin/downloads">{() => <AdminRoute component={AdminDownloads} />}</Route>
      <Route path="/admin/settings">{() => <AdminRoute component={AdminSettings} />}</Route>
      <Route path="/admin/admins">{() => <AdminRoute component={AdminAdmins} />}</Route>
      <Route path="/admin/reviews">{() => <AdminRoute component={AdminReviews} />}</Route>
      <Route path="/admin/balances">{() => <AdminRoute component={AdminBalances} />}</Route>

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
