const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema"); 
const Category = require("../../models/categorySchema");


const statusMap = {
  'pending': 'Pending',
  'processing': 'Processing', 
  'shipped': 'Shipped',
  'out-for-delivery': 'Out for Delivery', 
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'return-request': 'Return Request',
  'returned': 'Returned'
};

const getDisplayStatus = (schemaStatus) => {
  return Object.keys(statusMap).find(key => statusMap[key] === schemaStatus) || schemaStatus.toLowerCase().replace(/\s+/g, '-');
};
const getSchemaStatus = (displayStatus) => {
  return statusMap[displayStatus] || displayStatus;
};



const getAllOrders = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const statusFilter = req.query.status || "";
    const sort = req.query.sort || "activity-desc";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    
    

   let query = {};
    if (statusFilter) {
      const schemaStatusFilter = getSchemaStatus(statusFilter);
      query.status = schemaStatusFilter;
    }

    const allOrdersData = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName')
      .sort({updatedAt: -1, createdOn: -1 })
      .lean();
    console.log(`Fetched ${allOrdersData.length} orders; Returns found: ${allOrdersData.filter(o => o.status === 'Return Request').length}`); 
     
    let filteredOrders = allOrdersData;
    if (search) {
      filteredOrders = allOrdersData.filter(order =>
        order.orderId?.toLowerCase().includes(search.toLowerCase()) ||
        order.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        order.userId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        order.returnReason?.toLowerCase().includes(search.toLowerCase()) 
      );
    }
    // Apply sorting on filtered data
    // switch(sort) {
    //   case 'date-asc':
    //     filteredOrders.sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));
    //     break;
    //   case 'amount-desc':
    //     filteredOrders.sort((a, b) => (b.finalAmount || 0) - (a.finalAmount || 0));
    //     break;
    //   case 'amount-asc':
    //     filteredOrders.sort((a, b) => (a.finalAmount || 0) - (b.finalAmount || 0));
    //     break;
    //   default: 
    //     filteredOrders.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    // }


    switch(sort) {
      case 'date-asc':
        filteredOrders.sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));
        break;
      case 'amount-desc':
        filteredOrders.sort((a, b) => (b.finalAmount || 0) - (a.finalAmount || 0));
        break;
      case 'amount-asc':
        filteredOrders.sort((a, b) => (a.finalAmount || 0) - (b.finalAmount || 0));
        break;
      case 'activity-desc': 
        filteredOrders.sort((a, b) => new Date(b.updatedAt || b.createdOn) - new Date(a.updatedAt || a.createdOn));
        break;
      default: 
        filteredOrders.sort((a, b) => new Date(b.updatedAt || b.createdOn) - new Date(a.updatedAt || a.createdOn));
    }

    const count = filteredOrders.length;
    const ordersData = filteredOrders.slice(skip, skip + limit);
    const totalPages = Math.ceil(count / limit);
    const formattedOrders = ordersData.map(order => ({
      id: order.orderId, 
      date: order.createdOn ? order.createdOn.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      time: order.createdOn ? order.createdOn.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '12:00 PM',
      customer: {
        name: order.address?.name || order.userId?.name || 'Unknown',
        email: order.userId?.email || 'N/A',
        phone: order.address?.phone || order.userId?.phone || 'N/A',
        address: order.address ? `${order.address.address || ''}, ${order.address.city || ''},
         ${order.address.state || ''} `.trim()
         || 'N/A' : 'N/A'
      
      },
      returnReason: order.returnReason,
      products: order.orderedItems?.map(item => ({
        name: item.product?.productName || 'Unknown Product',
        status: getDisplayStatus(order.status)
      })) || [],
      amount: order.finalAmount || 0,
      discount: order.discount || 0,
      status: getDisplayStatus(order.status)
    }));
    res.render('order', {
      title: 'Order Management',
      orders: formattedOrders,
      currentPage: page,
      totalPages,
      itemsPerPage: limit,
      searchQuery: search,
      statusFilter,
      sortFilter: sort
    });
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    res.redirect('/pagerror');
  }
};



const updateOrderStatus = async (req, res) => {
  try {  
    const { id } = req.params;
    const { status: newStatus } = req.body;
    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'out-for-delivery', 'delivered', 'cancelled', 'return-request', 'returned'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    console.log('✓ Status validation passed');

    // Try to find order by BOTH orderId (string) AND _id (ObjectId)
    console.log('Searching for order...');
    let order = await Order.findOne({ orderId: id })
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName');

    // If not found by orderId, try by _id
    if (!order) {
      order = await Order.findById(id)
        .populate('userId', 'name email phone')
        .populate('orderedItems.product', 'productName');
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const oldStatus = order.status;
    const schemaStatus = getSchemaStatus(newStatus);
    
    console.log('Status conversion:', newStatus, '->', schemaStatus);

  if (newStatus === 'return-request') {
      if (!req.body.returnReason) {
        return res.status(400).json({ success: false, error: 'Return reason is mandatory' });
      }
      order.returnReason = req.body.returnReason;
    } else if (newStatus === 'returned') {
      // Approve: Ensure it was a return request
      if (oldStatus !== 'Return Request') {
        return res.status(400).json({ success: false, error: 'Can only approve from Return Request' });
      }
      // Increment stock (full order for now)
      for (let item of order.orderedItems) {
        const productId = item.product._id || item.product;
        await Product.findByIdAndUpdate(productId, {
          $inc: { stock: item.quantity }
        });
      }
    } else if (newStatus === 'delivered' && oldStatus === 'Return Request') {
      // Reject: Clear reason
      order.returnReason = null;
    } else if (newStatus === 'cancelled' && req.body.reason) {
      order.cancellationReason = req.body.reason;
    }

    // Update status
  //   order.statusHistory.push({
  //   status: 'Returned',
  //   timestamp: new Date(),
  //   reason: req.body.reason || 'Return approved by admin'
  // });

order.status = schemaStatus;
order.updatedAt = new Date();
order.statusHistory.push({
  status: schemaStatus,  // <- Dynamic, e.g., 'Shipped'
  timestamp: new Date(),
  reason: req.body.reason || null
});

    await order.save();

    // Handle stock restoration for cancellations
    if (newStatus === 'cancelled' && oldStatus !== 'Cancelled' && (oldStatus === 'Pending' || oldStatus === 'Processing')) {
      console.log('Restoring stock for', order.orderedItems.length, 'items');
      for (let item of order.orderedItems) {
        const productId = item.product._id || item.product;
        console.log('Restoring stock for product:', productId, 'qty:', item.quantity);
        await Product.findByIdAndUpdate(productId, {
          $inc: { stock: item.quantity }
        });
      }
      console.log(' Stock restored');
    }

    const updatedFormatted = {
      id: order.orderId || order._id,
      status: getDisplayStatus(order.status)
    };

    console.log('Sending response:', updatedFormatted);

    res.json({
      success: true,
      order: updatedFormatted
    });

  } catch (error) {
    console.error('ERROR in updateOrderStatus');
    return res.status(500).json({ 
      success: false, 
      error: 'Server error: ' + error.message 
    });
  }
};


// const inventory = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 4;

//         // Count total products for stats and pagination
//         const totalProducts = await Product.countDocuments({});

//         // Fetch products for the current page only
//         const products = await Product.find({})
//             .populate('category')
//             .skip((page - 1) * limit)
//             .limit(limit);

//         // Calculate stock stats (you can also calculate from all products if needed)
//         const allProducts = await Product.find({}); // fetch all for stats
//         let inStock = 0;
//         let lowStock = 0;
//         let outOfStock = 0;

//         allProducts.forEach(product => {
//             if (product.quantity > 10) inStock++;
//             else if (product.quantity > 0) lowStock++;
//             else outOfStock++;
//         });

//         const categories = await Category.find({});

//         res.render('inventory', {
//             products,
//             totalProducts,
//             inStock,
//             lowStock,
//             outOfStock,
//             categories,
//             statusFilter: '',
//             categoryFilter: '',
//             searchQuery: '',
//             pagination: { 
//                 current: page,
//                 totalPages: Math.ceil(totalProducts / limit),
//                 start: (page - 1) * limit + 1,
//                 end: Math.min(page * limit, totalProducts) 
//             }
//         });

//     } catch (err) {
//         console.log(err);
//         res.status(500).send('Server Error');
//     }
// };



// const inventory = async (req, res) => {
//   try {
//     const products = await Product.find().lean().sort({ productName: 1 }); 
//     res.render('admin/inventory', { products });
//   } catch (error) {
//     console.log(error);
//     res.redirect('/admin');
//   }
// };

const inventory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const statusFilter = req.query.status || '';
        const categoryFilter = req.query.category || '';
        const searchQuery = req.query.search || '';

        let filter = {};

        if (statusFilter === 'in-stock') filter.quantity = { $gt: 10 };
        else if (statusFilter === 'low-stock') filter.quantity = { $gt: 0, $lte: 10 };
        else if (statusFilter === 'out-of-stock') filter.quantity = 0;

        if (categoryFilter) {
            filter.category = categoryFilter; // categoryFilter is already the ObjectId from select value
        }

        if (searchQuery) {
            filter.productName = { $regex: searchQuery, $options: 'i' }; // Changed from 'name' to 'productName'
        }

        const totalProducts = await Product.countDocuments(filter);

        const products = await Product.find(filter)
            .populate('category')
            .skip((page - 1) * limit)
            .limit(limit);

        const allProducts = await Product.find({}); 
        let inStock = 0, lowStock = 0, outOfStock = 0;
        allProducts.forEach(product => {
            if (product.quantity > 10) inStock++;
            else if (product.quantity > 0) lowStock++;
            else outOfStock++;
        });

        const categories = await Category.find({});
        
        res.render('inventory', {
            products,
            totalProducts,
            inStock,
            lowStock,
            outOfStock,
            categories,
            statusFilter,
            categoryFilter,
            searchQuery,
            pagination: { 
                current: page,
                totalPages: Math.ceil(totalProducts / limit),
                start: (page - 1) * limit + 1,
                end: Math.min(page * limit, totalProducts) 
            }
        });

    } catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  inventory
};