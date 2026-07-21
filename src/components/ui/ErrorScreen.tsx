import { StatusBar } from "expo-status-bar";
import { Pressable, Text, View } from "react-native";
import { AppIcon } from "./AppIcon";

const BLUE = "#3E86F0";

type ErrorScreenProps = {
  errorMessage: string;
  onRetry: () => void;
  onBack: () => void;
};

export function ErrorScreen({
  errorMessage,
  onRetry,
  onBack,
}: ErrorScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <StatusBar style="dark" />
      <View className="size-20 items-center justify-center rounded-full bg-[#FDECEC]">
        <AppIcon
          name="exclamationmark.triangle.fill"
          size={34}
          tintColor="#E5484D"
        />
      </View>
      <Text className="mt-8 text-center text-[22px] font-bold text-[#0F1B2D]">
        Gagal Membuat Perjalanan
      </Text>
      <Text className="mt-3 text-center text-[16px] leading-6 text-[#8A94A6]">
        Terjadi masalah saat membuat itinerary. Silakan coba lagi beberapa saat
        lagi.
      </Text>
      <View className="mt-4 rounded-xl bg-[#F8F9FB] p-4">
        <Text className="text-center text-[14px] text-[#5A6472]">
          {errorMessage}
        </Text>
      </View>

      <Pressable
        onPress={onRetry}
        className="mt-10 h-14 w-full flex-row items-center justify-center gap-2 rounded-full"
        style={{ backgroundColor: BLUE }}
      >
        <AppIcon name="arrow.clockwise" size={18} tintColor="#FFFFFF" />
        <Text className="text-[17px] font-bold text-white">Coba Lagi</Text>
      </Pressable>
      <Pressable
        onPress={onBack}
        className="mt-3 h-12 items-center justify-center"
      >
        <Text className="text-[16px] font-semibold text-[#8A94A6]">
          Kembali ke Generate Trip
        </Text>
      </Pressable>
    </View>
  );
}
