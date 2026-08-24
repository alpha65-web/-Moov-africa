import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // Pastille de developpement de Next.js, affichee par-dessus l'interface en bas a
  // gauche. Elle recouvrait le profil utilisateur de la barre laterale et n'a rien a
  // faire pendant une demonstration. Les erreurs de compilation et d'execution
  // restent signalees dans le terminal et la console du navigateur.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
