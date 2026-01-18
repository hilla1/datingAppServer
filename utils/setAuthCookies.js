export const setAuthCookies = (res, token) => {

  // Secure token cookie (auth)
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Frontend-accessible cookie for redirect
  res.cookie('twb', 'session', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};
