import { useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";

type SSOStrategy = "oauth_google" | "oauth_apple";

WebBrowser.maybeCompleteAuthSession();

export function useSSOAuth() {
  const { startSSOFlow } = useSSO();

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
          redirectUrl: AuthSession.makeRedirectUri(),
        });

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
      } catch (err) {
        console.error("SSO sign-in error", JSON.stringify(err, null, 2));
      } finally {
        setPendingStrategy(null);
      }
    },
    [startSSOFlow, pendingStrategy],
  );

  return { signInWith, pendingStrategy };
}
