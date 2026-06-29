import { Text, StyleSheet } from "react-native";
import { colors, radii, type } from "../config/theme";

type Props = {
  label: string;
  variant: "person" | "product" | "company";
};

export function Tag({ label, variant }: Props) {
  return (
    <Text style={[styles.base, styles[variant]]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    ...type.meta,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  person: {
    color: colors.personText,
    backgroundColor: colors.personBg,
  },
  product: {
    color: colors.productText,
    backgroundColor: colors.productBg,
  },
  company: {
    color: colors.companyText,
    backgroundColor: colors.companyBg,
  },
});
