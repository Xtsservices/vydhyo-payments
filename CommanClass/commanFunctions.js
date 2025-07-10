const axios = require('axios');

class AppointmentService {
  static async getAppointmentById(id, type) {
    try {
      if (!id || !type) {
        throw new Error('Both ID and type are required');
      }

      const serviceMap = {
        appointment: {
          baseUrl: process.env.APPOINTMENTS_SERVICE_URL,
          endpoint: "appointment/getAppointment",
          paramName: 'appointmentId',
        },
        pharmacy: {
          baseUrl: process.env.USER_SERVICE_URL,
          endpoint: "pharmacy/getPharmacyDetail",
          paramName: 'pharmacyMedID',
        },
        lab: {
          baseUrl: process.env.USER_SERVICE_URL,
          endpoint: 'lab/getpatientTestDetails',
          paramName: 'labTestID',
        },
      };

      const config = serviceMap[type];
      if (!config) throw new Error('Invalid type provided');

      const url = `${config.baseUrl}${config.endpoint}?${config.paramName}=${id}`;
      const response = await axios.get(url);

      if (response.status !== 200 || !response.data) {
        throw new Error('Invalid response from service');
      }

      return response?.data?.data;
    } catch (error) {
      console.error("Error fetching data:", error.message);
      throw new Error("Failed to fetch data");
    }
  }
}

module.exports = AppointmentService;
