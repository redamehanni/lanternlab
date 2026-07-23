import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AME } from '../../theme';
import { resolveAmeIcon } from '../../icons/ameIcons';

/**
 * Icône dans un puits pastel — langage iconographique unifié.
 * Même « main » visuelle que les illustrations (calme, artisanal).
 */
export default function SoftIcon({
  name,
  active = false,
  size = 20,
  color,
  wellColor,
  wellSize = 44,
  radius,
  style,
}) {
  const icon = resolveAmeIcon(name, { active });
  const IconSet = icon.set === 'mci' ? MaterialCommunityIcons : Ionicons;
  const ink = color || AME.colors.primary;
  const well = wellColor || AME.colors.primarySoft;
  const r = radius ?? AME.radius.md;

  return (
    <View
      style={[
        styles.well,
        {
          width: wellSize,
          height: wellSize,
          borderRadius: r,
          backgroundColor: well,
        },
        style,
      ]}
    >
      <IconSet name={icon.name} size={size} color={ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
