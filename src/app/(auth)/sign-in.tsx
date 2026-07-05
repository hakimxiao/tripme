import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppleIcon, GoogleIcon } from "../../components/AuthIcons";
import { useSSOAuth } from "../../hooks/useSSOAuth";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";

  const { pendingStrategy, signInWith } = useSSOAuth();

  const busy = pendingStrategy !== null;
  const contentStyle = [
    styles.content,
    isAndroid && styles.contentAndroid,
    {
      paddingTop: insets.top + (isAndroid ? 28 : 0),
      paddingBottom: Math.max(insets.bottom, isAndroid ? 20 : 0) + 24,
    },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background image */}
      <Image
        source={require("../../../assets/images/auth-bg.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      {/* Dark gradient overlay for legibility */}
      <LinearGradient
        colors={[
          "rgba(8,28,42,0)",
          "rgba(8,28,42,0.35)",
          "rgba(7,22,35,0.85)",
          "rgba(6,18,30,0.97)",
        ]}
        locations={[0, 0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={contentStyle}>
        {/* Headline */}
        <Text style={[styles.title, isAndroid && styles.titleAndroid]}>
          Petualangan mu{"\n"} dimulai disini
        </Text>

        {/* Google btn */}
        <Pressable
          style={[
            styles.whiteButton,
            styles.firstButton,
            isAndroid && styles.whiteButtonAndroid,
            busy && styles.buttonDisabled,
          ]}
          disabled={busy}
          onPress={() => signInWith("oauth_google")}
        >
          {pendingStrategy === "oauth_google" ? (
            <ActivityIndicator color="#1F2430" />
          ) : (
            <>
              <GoogleIcon size={22} />
              <Text style={styles.whiteButtonText}>Lanjut dengan Google</Text>
            </>
          )}
        </Pressable>

        {/* Apple btn */}
        <Pressable
          style={[
            styles.whiteButton,
            isAndroid && styles.whiteButtonAndroid,
            busy && styles.buttonDisabled,
          ]}
          disabled={busy}
          onPress={() => signInWith("oauth_apple")}
        >
          {pendingStrategy === "oauth_apple" ? (
            <ActivityIndicator color="#1F2430" />
          ) : (
            <>
              <AppleIcon size={22} color="#000000" />
              <Text style={styles.whiteButtonText}>Lanjut dengan Apple</Text>
            </>
          )}
        </Pressable>

        {/* Footer */}
        <Text style={[styles.footer, isAndroid && styles.footerAndroid]}>
          Dengan melanjutkan, anda menyetujui{"\n"}
          <Text style={styles.link}>Ketentuan Layanan</Text>
          <Text style={styles.footer}> dan </Text>
          <Text style={styles.link}>Kebijakan Privasi</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06121E",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
  },
  contentAndroid: {
    paddingHorizontal: 22,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 33,
    lineHeight: 40,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  titleAndroid: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0,
  },
  firstButton: {
    marginTop: 32,
  },
  whiteButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  whiteButtonAndroid: {
    height: 54,
    borderRadius: 27,
    marginTop: 14,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  whiteButtonText: {
    color: "#1F2430",
    fontSize: 17,
    fontWeight: "600",
  },
  footer: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 20,
  },
  footerAndroid: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
  },
  link: {
    color: "#4E9BFF",
    fontSize: 14,
    fontWeight: "500",
  },
});
