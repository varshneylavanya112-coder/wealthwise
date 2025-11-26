import styles from "../style";
import { arrowUp } from "../assets";
import { useEffect } from "react";
import axios from "axios";
import { useUser, SignInButton } from "@clerk/clerk-react";

const GetStarted = () => {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      // Send user data to backend (normalize Clerk user shape)
      const payload = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.primaryEmailAddress?.emailAddress,
      };
      axios
        .post(`${import.meta.env.VITE_API_URL}/api/save-user`, payload)
        .then((response) => {
          console.log("User saved:", response.data);
        })
        .catch((error) => {
          console.error("Error saving user:", error);
        });
    }
  }, [isSignedIn, user]);

  return (
    <SignInButton mode="modal">
      <div className={`${styles.flexCenter} w-[140px] h-[140px] rounded-full bg-blue-gradient p-[2px] cursor-pointer`}>
        <div className={`${styles.flexCenter} flex-col bg-primary w-[100%] h-[100%] rounded-full`}>
          {isSignedIn && user ? (
            <>
              <p className="font-poppins font-medium text-[18px] leading-[23.4px]">
                <span className="text-gradient">Welcome</span>
              </p>
              <p className="font-poppins font-medium text-[18px] leading-[23.4px]">
                <span className="text-gradient">{user.firstName || user.fullName || user.primaryEmailAddress?.emailAddress}</span>
              </p>
            </>
          ) : (
            <>
              <div className={`${styles.flexStart} flex-row`}>
                <p className="font-poppins font-medium text-[18px] leading-[23.4px]">
                  <span className="text-gradient">Login</span>
                </p>
                <img src={arrowUp} alt="arrow-up" className="w-[23px] h-[23px] object-contain" />
              </div>
            </>
          )}
        </div>
      </div>
    </SignInButton>
  );
};

export default GetStarted;