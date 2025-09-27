import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

export const PaymentLink = async (payment) => {
  try {
    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL;

    //generetate unique id
    const uniqueId = crypto.randomBytes(8).toString("hex");

    console.log("Unique ID:", uniqueId); // Debug log
    console.log(CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_BASE_URL,"urlsdata");


    // Generate unique linkId
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = currentDate.getFullYear();
    let linkId = `live_${day}${month}${year}_` + uniqueId;

    const payload = {
      link_id: linkId,
      link_amount: payment.amount,
      link_currency: payment.currency || "INR",
      customer_details: {
        customer_name: "Demo User",
        customer_email: "example@example.com",
        customer_phone: payment.mobile,
      },
      link_meta: {
        return_url: `${process.env.APPLICATION_URL}/paymentResponse?link_id=${linkId}`,
        notify_url: `${process.env.BASE_URL}/api/order/cashfreecallback`,
      },
      link_notify: {
        send_sms: false,
        send_email: false,
        payment_received: false,
      },
      link_payment_methods: ["upi"],
      link_purpose: "Payment",
    };

    console.log("Payment Link Payload:", payload); // Debug log

    // Make API request to Cashfree
    const response = await axios.post(`${CASHFREE_BASE_URL}/links`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
    });
    console.log("Cashfree Response:", response.data); // Debug log

    if (response.data) {
      const { link_url } = response.data;
      console.log("Link URL:", link_url); // Debug log
      return { link_url ,linkId};
    } else {
      console.error("Error creating payment link:", response.data);
      return null;
    }
  } catch (error) {
    console.error("Error creating payment link:", error);
    return null;
  }
};

export const getPaymentLinkDetails = async (linkId) => {
  try {
    // Cashfree API credentials
    const CASHFREE_APP_ID = process.env.pgAppID;
    const CASHFREE_SECRET_KEY = process.env.pgSecreteKey;
    const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL;

    console.log(CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_BASE_URL,"urlsdata");

    // Make API request to Cashfree
    const response = await axios.get(`${CASHFREE_BASE_URL}/links/${linkId}/orders`, {
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2025-01-01",
      },
    });
    
    console.log("Cashfree Link Details Response:", response.data); // Debug log

    if (response.data) {
      return response.data;
    } else {
      console.error("Error fetching payment link details:", response.data);
      return null;
    }
  } catch (error) {
    console.error("Error fetching payment link details:", error);
    return null;
  }
}