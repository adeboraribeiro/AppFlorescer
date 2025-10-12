import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const FlorescerPlusSettings = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Florescer+</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
});

export default FlorescerPlusSettings;
