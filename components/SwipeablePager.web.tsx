import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

interface SwipeablePagerProps {
  children: React.ReactNode[];
  initialPage?: number;
  onPageSelected?: (index: number) => void;
  style?: any;
}

export interface SwipeablePagerRef {
  setPage: (index: number) => void;
}

const SwipeablePager = forwardRef<SwipeablePagerRef, SwipeablePagerProps>(
  ({ children, initialPage = 0, onPageSelected, style }, ref) => {
    const [currentPage, setCurrentPage] = useState(initialPage);

    useImperativeHandle(ref, () => ({
      setPage: (index: number) => {
        setCurrentPage(index);
        onPageSelected?.(index);
      },
    }));

    useEffect(() => {
      setCurrentPage(initialPage);
    }, [initialPage]);

    return (
      <View style={[styles.container, style]}>
        {React.Children.map(children, (child, index) => (
          <View
            key={index}
            style={[
              styles.page,
              { display: currentPage === index ? 'flex' : 'none' },
            ]}
          >
            {child}
          </View>
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});

export default SwipeablePager;
