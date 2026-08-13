import { Routes, Route, Navigate } from "react-router-dom";
import { ClientLayout } from "@/layouts";
import { RequireRole } from "./RequireRole";
import { ROLES } from "@/utils";
import {
  HomePage,
  AuthPage,
  CheckoutPage,
  ContactPage,
  DishesPage,
  NewsDetailPage,
  MyOrdersPage,
  ProfilePage,
  RestaurantDetailPage,
  RestaurantsPage,
  TermsPage,
  PrivacyPage,
  CookiesPage,
} from "@/pages/web";

export const WebRouter = () => {
  return (
    <Routes>
      <Route element={<ClientLayout />}>
        {/* Rutas públicas */}
        <Route index element={<HomePage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="dishes" element={<DishesPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        
        {/* Rutas para Cookies */}
        <Route path="cookies" element={<CookiesPage />} />
        <Route path="politica-cookies" element={<CookiesPage />} />

        {/* Noticias */}
        <Route path="news" element={<NewsDetailPage />} />
        <Route path="news/:id" element={<NewsDetailPage />} />

        {/* Restaurantes */}
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route path="restaurants/:id" element={<RestaurantDetailPage />} />

        {/* Rutas exclusivas para el CLIENTE */}
        <Route element={<RequireRole allowedRoles={[ROLES?.CLIENT || "client"]} redirectTo="/auth" />}>
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="my-orders" element={<MyOrdersPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Redirección comodín al home para rutas inexistentes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default WebRouter;