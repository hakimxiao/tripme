import { useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { type Href, useRouter } from "expo-router";
import { useCallback, useState } from "react";

type SSOStrategy = "oauth_google" | "oauth_apple";
const REDIRECT_URL = AuthSession.makeRedirectUri({
  scheme: "tripme",
  path: "/sso-callback",
});

WebBrowser.maybeCompleteAuthSession();

export function useSSOAuth() {
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [pendingStrategy, setPendingStrategy] = useState<SSOStrategy | null>(
    null,
  );

  const signInWith = useCallback(
    async (strategy: SSOStrategy) => {
      if (pendingStrategy) return;
      setPendingStrategy(strategy);

      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy,
          redirectUrl: REDIRECT_URL,
        });

        if (createdSessionId && setActive) {
          await setActive({
            session: createdSessionId,
            navigate: async ({ session, decorateUrl }) => {
              if (session?.currentTask) {
                console.log(session.currentTask);
                return;
              }

              router.replace(decorateUrl("/") as Href);
            },
          });
        }
      } catch (err) {
        console.error("SSO sign-in error", JSON.stringify(err, null, 2));
      } finally {
        setPendingStrategy(null);
      }
    },
    [startSSOFlow, pendingStrategy, router],
  );

  return { signInWith, pendingStrategy };
}
