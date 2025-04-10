export const logout = async () => {
  try {
    const response = await fetch("http://localhost:8080/api/users/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 204) {
      return;
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (error) {
    throw error;
  }
};

export const join = async (joinRequest: {
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  provider: string;
  oauthId: string;
  birthDate: string;
}) => {
  try {
    const response = await fetch("http://localhost:8080/api/users/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(joinRequest),
    });

    if (response.ok) {
      const rsData = await response.json();
      return rsData;
    }

    throw new Error(await response.text());
  } catch (error) {
    console.error("회원가입 API 오류:", error);
    throw error;
  }
};
