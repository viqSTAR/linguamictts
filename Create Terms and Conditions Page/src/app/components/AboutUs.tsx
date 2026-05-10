import { Link } from "react-router";
import { motion } from "motion/react";
import { Globe, Users, Mail, MapPin } from "lucide-react";

export default function AboutUs() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  const features = [
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Global Vision",
      description: "Building from India with a mission to connect voices across the world",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "For Everyone",
      description: "Creators, professionals, and anyone who works across languages",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="px-6 py-6 max-w-6xl mx-auto flex gap-6 flex-wrap">
        <Link to="/" className="text-gray-600 hover:text-orange-500 transition-colors">
          Terms & Conditions
        </Link>
        <Link to="/privacy-policy" className="text-gray-600 hover:text-orange-500 transition-colors">
          Privacy Policy
        </Link>
        <Link to="/attributions" className="text-gray-600 hover:text-orange-500 transition-colors">
          Attributions
        </Link>
      </nav>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="px-6 py-16 max-w-4xl mx-auto text-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-block mb-6"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full mx-auto flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Globe className="w-10 h-10 text-white" />
            </motion.div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-6xl font-bold text-black mb-6"
        >
          About Us
        </motion.h1>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100px" }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="h-1 bg-gradient-to-r from-orange-500 to-orange-600 mx-auto mb-8"
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-2xl text-gray-600 italic mb-4"
        >
          Your voice, any language, any emotion
        </motion.p>
      </motion.div>

      {/* Main Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mx-auto px-6 pb-16"
      >
        {/* Mission Statement */}
        <motion.div variants={itemVariants} className="mb-16">
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-black mb-6">What We Do</h2>
            <p className="text-gray-700 leading-relaxed text-lg mb-4">
              LinguaMic is an AI-powered voice platform built for creators, professionals, and anyone who works across languages. We provide text-to-speech, speech-to-text, and real-time voice translation tools designed to make communication effortless and natural.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              We are an early-stage startup founded by <span className="text-orange-500 font-semibold">Abhishek</span> and <span className="text-orange-500 font-semibold">Vikashdeep</span>, building from India with a global vision.
            </p>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.03, y: -5 }}
              transition={{ duration: 0.3 }}
              className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-orange-500 hover:shadow-lg transition-all"
            >
              <motion.div
                initial={{ rotate: 0 }}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-500"
              >
                {feature.icon}
              </motion.div>
              <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Mission */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-10 text-center mb-16 shadow-lg"
        >
          <motion.h2
            initial={{ scale: 0.9 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-white mb-4"
          >
            Our Mission
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white text-xl"
          >
            Your voice, any language, any emotion
          </motion.p>
        </motion.div>

        {/* Contact Information */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
          <motion.div
            whileHover={{ x: 5 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4 bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 flex-shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Contact</p>
              <a
                href="mailto:company@linguamic.com"
                className="text-black font-medium hover:text-orange-500 transition-colors"
              >
                company@linguamic.com
              </a>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ x: 5 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4 bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 flex-shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Location</p>
              <p className="text-black font-medium">Patna, Bihar, India</p>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="bg-black text-white py-16 px-6 text-center"
      >
        <motion.h3
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-3xl font-bold mb-4"
        >
          Ready to get started?
        </motion.h3>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-gray-400 text-lg mb-8"
        >
          Join thousands of users transforming voice communication
        </motion.p>
        <motion.a
          href="mailto:company@linguamic.com"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full font-semibold transition-colors"
        >
          Contact Us
        </motion.a>
      </motion.div>
    </div>
  );
}
