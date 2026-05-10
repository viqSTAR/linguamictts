import { createBrowserRouter } from "react-router";
import TermsAndConditions from "./components/TermsAndConditions";
import PrivacyPolicy from "./components/PrivacyPolicy";
import AboutUs from "./components/AboutUs";
import Attributions from "./components/Attributions";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: TermsAndConditions,
  },
  {
    path: "/privacy-policy",
    Component: PrivacyPolicy,
  },
  {
    path: "/about-us",
    Component: AboutUs,
  },
  {
    path: "/attributions",
    Component: Attributions,
  },
]);
