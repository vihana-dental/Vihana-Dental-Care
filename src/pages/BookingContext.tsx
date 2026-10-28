import { createContext, useContext } from 'react';

/** Lets any page component open the same booking modal the home page uses. */
export const BookingContext = createContext<{ openBooking: (serviceId?: string) => void }>({
  openBooking: () => {}
});

export const useBooking = () => useContext(BookingContext);
