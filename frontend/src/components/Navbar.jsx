import { useState } from "react";
import { close, logo, menu } from "../assets";
import { navLinks } from "../constants";
import { Link, useNavigate } from "react-router-dom";

// Clerk imports — this is all you need
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
  useUser,
} from "@clerk/clerk-react";

const Navbar = () => {
  const [active, setActive] = useState("Home");
  const [toggle, setToggle] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const navigate = useNavigate();
  const { user } = useUser(); // Optional: show user name/email

  const handleDropdownToggle = () => {
    setDropdown((prev) => !prev);
  };

  const handleNavClick = (navId, navTitle) => {
    setActive(navTitle);
    if (navId === "features") {
      navigate("/");
      setTimeout(() => {
        document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    } else if (navId !== "Options") {
      navigate(navId === "home" ? "/" : `/${navId}`);
    }
  };

  return (
    <nav className="w-full flex py-6 justify-between items-center navbar">
      <Link to="/" className="font-poppins font-semibold text-white text-[24px]">
        Phoenix Arcana
      </Link>

      {/* Desktop Menu */}
      <ul className="list-none sm:flex hidden justify-end items-center flex-1">
        {navLinks.map((nav, index) => (
          <li
            key={nav.id}
            className={`relative font-poppins font-normal cursor-pointer text-[16px] ${
              active === nav.title ? "text-white" : "text-dimWhite"
            } ${index === navLinks.length - 1 ? "mr-10" : "mr-10"}`}
            onClick={() => {
              if (nav.id === "Options") handleDropdownToggle();
              else handleNavClick(nav.id, nav.title);
            }}
          >
            {nav.id === "Options" ? (
              <>
                <span>{nav.title}</span>
                {dropdown && (
                  <ul className="absolute top-full left-0 mt-2 bg-gray-800 p-4 rounded-lg shadow-lg w-[200px] z-50">
                    <li className="text-white px-4 py-3 hover:bg-gray-700 cursor-pointer">
                      <Link to="/dashboard/stocks" onClick={() => setDropdown(false)}>
                        Stocks
                      </Link>
                    </li>
                    <li className="text-white px-4 py-3 hover:bg-gray-700 cursor-pointer">
                      <Link to="/dashboard/mutual-funds" onClick={() => setDropdown(false)}>
                        Mutual Funds
                      </Link>
                    </li>
                    <li className="text-white px-4 py-3 hover:bg-gray-700 cursor-pointer">
                      <Link to="/dashboard/crypto" onClick={() => setDropdown(false)}>
                        Crypto
                      </Link>
                    </li>
                  </ul>
                )}
              </>
            ) : (
              <span>{nav.title}</span>
            )}
          </li>
        ))}

        <li className="font-poppins font-normal cursor-pointer text-[16px] text-dimWhite mr-10">
          <Link to="/dashboard/portfolio">Portfolio</Link>
        </li>

        {/* Clerk Auth Buttons (Desktop) */}
        <SignedOut>
          <li className="ml-6">
            <SignInButton mode="modal">
              <button className="py-4 px-6 font-poppins font-medium text-[18px] text-primary bg-blue-gradient rounded-[10px] outline-none hover:opacity-90 transition">
                Login
              </button>
            </SignInButton>
          </li>
        </SignedOut>

        <SignedIn>
          <li className="ml-6 flex items-center gap-3">
            {user?.firstName && <span className="text-dimWhite">Hi, {user.firstName}!</span>}
            <UserButton afterSignOutUrl="/" />
          </li>
        </SignedIn>
      </ul>

      {/* Mobile Menu */}
      <div className="sm:hidden flex flex-1 justify-end items-center">
        <img
          src={toggle ? close : menu}
          alt="menu"
          className="w-[28px] h-[28px] object-contain cursor-pointer"
          onClick={() => setToggle(!toggle)}
        />

        <div
          className={`${
            !toggle ? "hidden" : "flex"
          } p-6 bg-black-gradient absolute top-20 right-0 mx-4 my-2 min-w-[140px] rounded-xl sidebar z-50`}
        >
          <ul className="list-none flex justify-end items-start flex-1 flex-col">
            {navLinks.map((nav, index) => (
              <li
                key={nav.id}
                className={`font-poppins font-medium cursor-pointer text-[16px] ${
                  active === nav.title ? "text-white" : "text-dimWhite"
                } ${index === navLinks.length - 1 ? "mb-4" : "mb-4"}`}
                onClick={() => {
                  if (nav.id === "Options") {
                    handleDropdownToggle();
                  } else {
                    handleNavClick(nav.id, nav.title);
                    setToggle(false);
                  }
                }}
              >
                {nav.id === "Options" ? (
                  <>
                    <span>{nav.title}</span>
                    {dropdown && (
                      <ul className="mt-4 ml-4">
                        <li className="text-white py-2">
                          <Link to="/dashboard/stocks" onClick={() => { setDropdown(false); setToggle(false); }}>
                            Stocks
                          </Link>
                        </li>
                        <li className="text-white py-2">
                          <Link to="/dashboard/mutual-funds" onClick={() => { setDropdown(false); setToggle(false); }}>
                            Mutual Funds
                          </Link>
                        </li>
                        <li className="text-white py-2">
                          <Link to="/dashboard/crypto" onClick={() => { setDropdown(false); setToggle(false); }}>
                            Crypto
                          </Link>
                        </li>
                      </ul>
                    )}
                  </>
                ) : (
                  <span>{nav.title}</span>
                )}
              </li>
            ))}

            <li className="font-poppins font-medium cursor-pointer text-[16px] text-dimWhite mb-4">
              <Link to="/dashboard/portfolio" onClick={() => setToggle(false)}>
                Portfolio
              </Link>
            </li>

            {/* Clerk Auth in Mobile */}
            <SignedOut>
              <li className="mt-4 w-full">
                <SignInButton mode="modal">
                  <button className="w-full py-4 px-6 font-poppins font-medium text-[18px] text-primary bg-blue-gradient rounded-[10px]">
                    Login
                  </button>
                </SignInButton>
              </li>
            </SignedOut>

            <SignedIn>
              <li className="mt-4 flex items-center gap-3">
                <span className="text-dimWhite text-sm">Hi, {user?.firstName || "User"}!</span>
                <UserButton afterSignOutUrl="/" />
              </li>
            </SignedIn>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;