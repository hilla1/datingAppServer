export const clearAuthCookies = (res) => {

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production'? 'none' : 'strict',
  });

  res.clearCookie('twb', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production'? 'none' : 'strict',
  });
};
