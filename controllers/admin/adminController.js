const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema"); 
const Product = require("../../models/productSchema");


const pageerror = async(req,res)=>{
  res.render("pagerror")
}

const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.render("admin-login", { message: "Invalid email or admin account not found" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("admin-login", { message: "Incorrect password" });
    }

   
    req.session.admin = true;
    return res.redirect("/admin");
  } catch (error) {
    console.error("Login error:", error);
    return res.redirect("/pagerror");
  }
};


// const loadDashboard = async (req,res)=>{
//      if(req.session.admin){
//         try{
//            const data = {
//             isAdmin: true,
//            };
//             res.render("dashboard",data);
            

//         }catch(error){
//             res.redirect("/pagerror")
//         }
//      }
// }

// const loadDashboard = async (req, res) => {
//     if (!req.session.admin) {
//         return res.redirect('/admin/login'); 
//     }
//     try {
//         // Fetch summary data (you can optimize with parallel promises)
//         const [totalUsers, totalOrders, totalProducts, revenueData, recentOrders] = await Promise.all([
//             User.countDocuments(),
//             Order.countDocuments({ status: { $ne: 'Cancelled' } }), // optional: exclude cancelled
//             Product.countDocuments({ isDeleted: false }),
//             getRevenueReport(req.query), // We'll define this below
//             Order.find()
//                 .sort({ createdAt: -1 })
//                 .limit(5)
//                 .populate('userId', 'name email') // optional: populate customer name
//                 .lean()
//         ]);

//         const { report, chartLabels, chartData, period, startDate, endDate } = revenueData;

//         res.render('dashboard', {
//             isAdmin: true,
//             totalUsers,
//             totalOrders,
//             totalProducts,
//             totalRevenue: report.totalAmount.toFixed(2),

//             // Sales Report Data
//             report,
//             chartLabels,
//             chartData,
//             period: period || 'monthly',
//             startDate: startDate || '',
//             endDate: endDate || '',

//             // Recent Orders
//             recentOrders: recentOrders.map(order => ({
//                 orderId: order.orderId || order._id.toString().slice(-6),
//                 customerName: order.userId?.name || 'Guest',
//                 finalAmount: order.finalAmount || order.totalAmount,
//                 status: order.status
//             }))
//         });

//     } catch (error) {
//         console.error('Dashboard Load Error:', error);
//         res.redirect('/admin/pageerror'); 
//     }
// };

// // Helper function to generate sales report based on period
// const getRevenueReport = async (query) => {
//     let { period = 'monthly', start, end } = query;

//     let match = {};
//     let groupFormat = '%Y-%m'; // Default: Monthly

//     switch (period) {
//         case 'daily':   groupFormat = '%Y-%m-%d'; break;
//         case 'weekly':  groupFormat = '%Y-%U'; break;
//         case 'yearly':  groupFormat = '%Y'; break;
//         case 'custom':
//             if (start && end) {
//                 match.createdAt = {
//                     $gte: new Date(start),
//                     $lte: new Date(new Date(end).setHours(23, 59, 59, 999))
//                 };
//                 groupFormat = '%Y-%m-%d';
//             }
//             break;
//     }

//     // Aggregate for chart
//     const salesAggregation = await Order.aggregate([
//         { $match: match },
//         {
//             $group: {
//                 _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
//                 totalSales: { $sum: '$finalAmount' }
//             }
//         },
//         { $sort: { _id: 1 } }
//     ]);

//     // All orders in the period for table & summary
//     const orders = await Order.find(match)
//         .sort({ createdAt: -1 })
//         .lean();

//     const totalAmount = orders.reduce((sum, o) => sum + (o.amount || o.totalAmount || 0), 0);
//     const totalDiscount = orders.reduce((sum, o) => sum + (o.discount || 0), 0);

//     const report = {
//         totalOrders: orders.length,
//         totalAmount,
//         totalDiscount,
//         orders: orders.map(o => ({
//             orderId: o.orderId || o._id.toString().slice(-6),
//             date: o.createdAt,
//             amount: o.amount || o.totalAmount || 0,
//             discount: o.discount || 0,
//             coupon: o.couponCode || 'N/A',
//             finalAmount: o.finalAmount || o.totalAmount || 0
//         }))
//     };

//     const chartLabels = salesAggregation.map(item => {
//         if (period === 'weekly') return `Week ${item._id.split('-')[1]} ${item._id.split('-')[0]}`;
//         return item._id;
//     });
//     const chartData = salesAggregation.map(item => item.totalSales);

//     return { report, chartLabels, chartData, period, startDate: start, endDate: end };
// };


const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        const [ 
            totalUsers,
            totalOrders,
            totalProducts,
            revenueData,
            recentCompletedRaw
        ] = await Promise.all([
            User.countDocuments(),
            Order.countDocuments({ status: { $ne: 'Cancelled' } }),
            Product.countDocuments({ isDeleted: false }),
            getRevenueReport(req.query),
            Order.find({ 
                status: { $in: ['Delivered', 'Completed'] } 
            })
                .sort({ createdOn: -1 })
                .limit(5)
                .populate('userId', 'name email')
                .lean()
        ]);

        const { report, chartLabels, chartData, period, startDate, endDate } = revenueData;

        const recentCompletedOrders = recentCompletedRaw.map(order => ({
            orderId: order.orderId || order._id?.toString().slice(-6) || 'N/A',
            customerName: order.userId?.name || 'Guest',
            finalAmount: Number(order.finalAmount || order.totalAmount || order.totalPrice || 0),
            status: order.status
        }));

        // FIX: Make sure we're passing all the chart data
        res.render('dashboard', {
            isAdmin: true,
            totalUsers,
            totalOrders,
            totalProducts,
            totalRevenue: Number(report?.totalAmount || 0).toFixed(2),
            
            chartLabels: chartLabels || [],
            chartData: chartData || [],
            
            // Sales Report Data
            report,
            period: period || 'monthly',
            startDate: startDate || '',
            endDate: endDate || '',
            
            recentCompletedOrders
        });

    } catch (error) {
        console.error('Dashboard Load Error:', error);
        res.redirect('/admin/pageerror');
    }
};



const downloadSalesReport = async (req, res) => {
    try {
        const { format, period = 'monthly', start, end } = req.query;

        // Get the report data using existing helper
        const { report } = await getRevenueReport({ period, start, end });

        if (format === 'pdf') {
            // PDF Download
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50 });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${period}-${Date.now()}.pdf`);
            
            doc.pipe(res);

            // Header
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Period: ${period.toUpperCase()}`, { align: 'center' });
            if (start && end) {
                doc.text(`Date Range: ${start} to ${end}`, { align: 'center' });
            }
            doc.moveDown(2);

            // Summary
            doc.fontSize(14).text('Summary', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11);
            doc.text(`Total Orders: ${report.totalOrders}`);
            doc.text(`Total Amount: ₹${report.totalAmount.toFixed(2)}`);
            doc.text(`Total Discount: ₹${report.totalDiscount.toFixed(2)}`);
            doc.moveDown(2);

            // Table Header
            doc.fontSize(14).text('Order Details', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(9);

            const tableTop = doc.y;
            const colWidths = [80, 80, 80, 80, 80, 100];
            
            // Headers
            doc.text('Order ID', 50, tableTop);
            doc.text('Date', 130, tableTop);
            doc.text('Amount', 210, tableTop);
            doc.text('Discount', 290, tableTop);
            doc.text('Coupon', 370, tableTop);
            doc.text('Final Amount', 450, tableTop);
            
            doc.moveDown();
            let yPos = doc.y + 5;

            // Rows
            report.orders.forEach(order => {
                if (yPos > 700) {
                    doc.addPage();
                    yPos = 50;
                }
                
                doc.text(order.orderId, 50, yPos);
                doc.text(new Date(order.date).toLocaleDateString(), 130, yPos);
                doc.text(`₹${order.amount.toFixed(2)}`, 210, yPos);
                doc.text(`₹${order.discount.toFixed(2)}`, 290, yPos);
                doc.text(order.coupon, 370, yPos);
                doc.text(`₹${order.finalAmount.toFixed(2)}`, 450, yPos);
                
                yPos += 20;
            });

            doc.end();

        } else if (format === 'excel') {
            // Excel Download
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Title
            worksheet.mergeCells('A1:F1');
            worksheet.getCell('A1').value = 'Sales Report';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            // Period info
            worksheet.mergeCells('A2:F2');
            worksheet.getCell('A2').value = `Period: ${period.toUpperCase()}`;
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            if (start && end) {
                worksheet.mergeCells('A3:F3');
                worksheet.getCell('A3').value = `Date Range: ${start} to ${end}`;
                worksheet.getCell('A3').alignment = { horizontal: 'center' };
            }

            // Summary section
            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.addRow(['Total Orders', report.totalOrders]);
            worksheet.addRow(['Total Amount', `₹${report.totalAmount.toFixed(2)}`]);
            worksheet.addRow(['Total Discount', `₹${report.totalDiscount.toFixed(2)}`]);
            worksheet.addRow([]);

            // Table headers
            worksheet.addRow(['Order ID', 'Date', 'Amount', 'Discount', 'Coupon', 'Final Amount']);
            const headerRow = worksheet.lastRow;
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };

            // Data rows
            report.orders.forEach(order => {
                worksheet.addRow([
                    order.orderId,
                    new Date(order.date).toLocaleDateString(),
                    order.amount,
                    order.discount,
                    order.coupon,
                    order.finalAmount
                ]);
            });

            // Column widths
            worksheet.columns = [
                { width: 15 },
                { width: 15 },
                { width: 15 },
                { width: 15 },
                { width: 15 },
                { width: 15 }
            ];

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${period}-${Date.now()}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        }

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).send('Error generating report');
    }
};


const getRevenueReport = async (query = {}) => {
  let { period = 'monthly', start, end } = query;

  let match = {};
  let groupFormat = '%Y-%m';
  const now = new Date();

  // ───── Date filters ─────
  if (period === 'daily') {
    const startDay = new Date();
    startDay.setHours(0,0,0,0);
    const endDay = new Date();
    endDay.setHours(23,59,59,999);

    match.createdOn = { $gte: startDay, $lte: endDay };
    groupFormat = '%H:00';

  } else if (period === 'weekly') {
    const startWeek = new Date();
    startWeek.setDate(startWeek.getDate() - startWeek.getDay());
    startWeek.setHours(0,0,0,0);

    const endWeek = new Date(startWeek);
    endWeek.setDate(startWeek.getDate() + 6);
    endWeek.setHours(23,59,59,999);

    match.createdOn = { $gte: startWeek, $lte: endWeek };
    groupFormat = '%Y-%m-%d';

  } else if (period === 'monthly') {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999);

    match.createdOn = { $gte: startMonth, $lte: endMonth };
    groupFormat = '%Y-%m-%d';

  } else if (period === 'yearly') {
    const startYear = new Date(now.getFullYear(), 0, 1);
    const endYear = new Date(now.getFullYear(), 11, 31, 23,59,59,999);

    match.createdOn = { $gte: startYear, $lte: endYear };
    groupFormat = '%Y-%m';

  } else if (period === 'custom' && start && end) {
    match.createdOn = {
      $gte: new Date(start),
      $lte: new Date(new Date(end).setHours(23,59,59,999))
    };
    groupFormat = '%Y-%m-%d';
  }

  // ───── Chart aggregation ─────
  const salesAggregation = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdOn' } },
        totalSales: { $sum: '$finalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // ───── Fetch orders for summary & table ─────
  const orders = await Order.find(match).lean();

  const totalAmount = orders.reduce(
    (sum, o) => sum + Number(o.finalAmount || o.totalPrice || 0), 0
  );

  const totalDiscount = orders.reduce(
    (sum, o) => sum + Number(o.discount || 0), 0
  );

  const report = {
    totalOrders: orders.length,
    totalAmount,
    totalDiscount,
    orders: orders.map(o => ({
      orderId: o.orderId || o._id.toString().slice(-6),
      date: o.createdOn,
      amount: Number(o.totalPrice || 0),
      discount: Number(o.discount || 0),
      coupon: o.couponApplied ? 'Applied' : 'N/A',
      finalAmount: Number(o.finalAmount || 0)
    }))
  };

  const chartLabels = salesAggregation.map(i => i._id);
  const chartData = salesAggregation.map(i => i.totalSales);

  return {
    report,
    chartLabels,
    chartData,
    period,
    startDate: start || '',
    endDate: end || ''
  };
};



const getSalesReport = async (req, res) => {
    try {
        const { period = 'monthly', start, end } = req.query;

        let match = {};
        let groupByFormat = '%Y-%m';   // monthly default

        // ──── Date filtering logic ───────────────────────────────
        if (period === 'daily') {
            groupByFormat = '%Y-%m-%d';
        } else if (period === 'weekly') {
            groupByFormat = '%Y-%U';   // year + week number
        } else if (period === 'yearly') {
            groupByFormat = '%Y';
        } else if (period === 'custom' && start && end) {
            const startDate = new Date(start);
            const endDate   = new Date(end);
            endDate.setHours(23,59,59,999);   // end of day

            match.createdAt = { $gte: startDate, $lte: endDate };
            groupByFormat = '%Y-%m-%d';   // daily buckets for custom
        }

        // ──── Chart data (time series aggregation) ───────────────
        const chartData = await Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id:   { $dateToString: { format: groupByFormat, date: "$createdAt" } },
                    total: { $sum: "$finalAmount" },
                    count: { $sum: 1 },
                    discountSum: { $sum: "$discount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // ──── Summary totals for selected period ─────────────────
        const summary = await Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalOrders:    { $sum: 1 },
                    totalAmount:    { $sum: "$finalAmount" },
                    totalDiscount:  { $sum: "$discount" }
                }
            }
        ]);

        const totals = summary[0] || { totalOrders: 0, totalAmount: 0, totalDiscount: 0 };

        // ──── Prepare data for chart & labels ────────────────────
        const labels = chartData.map(item => {
            if (period === 'weekly') {
                const [year, week] = item._id.split('-');
                return `W${week} ${year}`;
            }
            return item._id;
        });

        const amounts = chartData.map(item => item.total || 0);

        // ──── Recent orders for table (last 20 or so) ────────────
        const recentOrders = await Order.find(match)
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const formattedOrders = recentOrders.map(o => ({
            orderId:     o.orderId || o._id.toString().slice(-8),
            date:        o.createdAt.toISOString().split('T')[0],
            amount:      o.finalAmount || 0,
            discount:    o.discount || 0,
            coupon:      o.couponCode || '-',
            finalAmount: o.finalAmount || 0,
            status:      o.status
        }));

        res.render('admin/sales-report', {
            period,
            startDate: start || '',
            endDate:   end || '',
            totals,
            chart: {
                labels,
                amounts
            },
            orders: formattedOrders
        });

    } catch (err) {
        console.error(err);
        res.status(500).render('admin/error', { message: 'Failed to load sales report' });
    }
};

const logout = async (req,res)=>{
        try{
          req.session.admin = null;
           res.redirect("/admin/login")
        

        }catch(error){
           console.log("Error destroying error during logout",error);
           res.redirect("/pagerror")
        }
     }




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    getSalesReport,
    downloadSalesReport,
    pageerror,
    logout
}